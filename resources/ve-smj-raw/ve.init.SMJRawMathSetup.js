// ve.init.SMJRawMathSetup.js
//
// ve.activationComplete 後に DM を走査し、テキスト中の raw LaTeX を
// SMJRawMathNode のトランザクションに変換する。
//
// undoスタックに乗る問題は既知・先送り。
// ユーザーが意図せず Ctrl+Z した場合は Ctrl+Y で戻せる。

( function () {

/* eslint indent: ["error", "tab", { "outerIIFEBody": "off" }] */
'use strict';

// ----------------------------------------------------------------
// FindTeX ラッパー
// MathJax startup.input[0] の findMath を安全に呼ぶ。
// 返り値: Array<{ math, start:{n}, end:{n}, open, close, display }>
// ----------------------------------------------------------------
function findRawMath( text ) {
	var inputJax = window.MathJax &&
				MathJax.startup &&
				MathJax.startup.input &&
				MathJax.startup.input[ 0 ];
	if ( !inputJax || typeof inputJax.findMath !== 'function' ) {
		return [];
	}
	try {
		// findMath は文字列の配列を受け取る（MathJax v3 TeX input jax）
		return inputJax.findMath( [ text ] ) || [];
	} catch ( e ) {
		mw.log.warn( '[SMJRawMath] findMath error:', e );
		return [];
	}
}

// ----------------------------------------------------------------
// DM線形モデルを走査して変換候補を収集する
//
// 線形モデルの構造（例）:
//   offset 0: { type: 'paragraph' }
//   offset 1: 'T'
//   offset 2: 'h'
//   ...
//   offset N: '$'
//   offset N+1: 'E'
//   ...
//   offset M: { type: '/paragraph' }
//
// テキスト文字は文字列またはアノテーション付き配列 ['X', [annot,...]]
// として格納されている。
//
// 返り値:
//   Array<{
//     rangeStart: number,   // DMオフセット（$の先頭）
//     rangeEnd:   number,   // DMオフセット（$の末尾の次）
//     latex:      string,
//     delim:      Object  // ve.smj.Delim オブジェクト
//   }>
// ----------------------------------------------------------------
function collectReplacements( dmDoc ) {
	var data = dmDoc.data;
	var dataLength = data.getLength();
	var replacements = [];

	// 段落・見出し等のコンテンツノードを走査する
	// テキスト文字が連続している区間を文字列として取り出し
	// findMath にかける

	var i = 0;
	while ( i < dataLength ) {
		var item = data.getData( i );

		// 開き要素を検出
		if ( !( item && typeof item === 'object' &&
				item.type && item.type.charAt( 0 ) !== '/' ) ) {
			i++;
			continue;
		}

		// コンテンツを持てるノードのみ対象
		// （paragraph, heading 等。table cell も含む）
		var node = dmDoc.getDocumentNode().getNodeFromOffset( i + 1 );
		if ( !node || !node.canContainContent || !node.canContainContent() ) {
			i++;
			continue;
		}

		var nodeRange = node.getRange();

		// MathJax.skipHtmlTagsで指定されているpre等を除外する
		// 標準のwikitext仕様で該当するのはmwPreformattedとmwPreだが、
		// mwPreはコンテンツを持てるノードではない（中身をDMに展開しない）ので上のifで除外済み
		if ( item.type === 'mwPreformatted' ) {
			i = nodeRange.end;
			continue;
		}

		// ノード内をインラインノード境界で「テキストチャンク」に分割する
		// span境界等（nowiki境界を除く）でも分割する
		// チャンク = { text: string, offsetMap: number[] }
		// offsetMap[j] = text[j] に対応するDMオフセット
		var chunks = [];
		var curText = '';
		var curMap = [];
		var curAnnotations = '';

		for ( var j = nodeRange.start; j < nodeRange.end; j++ ) {
			var ch = data.getData( j );

			// FIXME: （文字参照ノードは展開する）
			if ( typeof ch === 'string' ) {
				const nextAnnotations = '';
				if ( curAnnotations !== nextAnnotations ) {
					// ここでチャンクを確定する
					if ( curText.length ) {
						chunks.push( { text: curText, offsetMap: curMap } );
						curText = '';
						curMap = [];
					}
					curAnnotations = nextAnnotations;
				}
				curText += ch;
				curMap.push( j );
			} else if ( Array.isArray( ch ) && typeof ch[ 0 ] === 'string' ) {
				// アノテーション付き文字 ['X', [annot,...]]
				// MathJax.skipHtmlTagsで指定されているcodeを除外する
				var isCode = false;
				const nextAnnotations = ch[ 1 ].filter( function ( anno ) {
					var obj = dmDoc.getStore().value( anno );
					if ( !Array.isArray( obj ) && obj.name === 'textStyle/code' ) {
						isCode = true;
					}
					return !( !Array.isArray( obj ) && obj.name === 'mwNowiki' );
				} ).join();
				if ( curAnnotations !== nextAnnotations ) {
					// ここでチャンクを確定する
					if ( curText.length ) {
						chunks.push( { text: curText, offsetMap: curMap } );
						curText = '';
						curMap = [];
					}
					curAnnotations = nextAnnotations;
				}
				if ( !isCode ) {
					curText += ch[ 0 ];
					curMap.push( j );
				}
			} else if ( ch && typeof ch === 'object' && ch.type ) {
				// インラインノード（開き or 閉じ要素）
				// ここでチャンクを確定する
				if ( curText.length ) {
					chunks.push( { text: curText, offsetMap: curMap } );
					curText = '';
					curMap = [];
				}
				// インラインノードの閉じ要素まで j を進める
				if ( ch.type.charAt( 0 ) !== '/' ) {
					// 開き要素 → 対応する閉じ要素を探す
					var depth = 1;
					j++;
					while ( j < nodeRange.end && depth > 0 ) {
						var inner = data.getData( j );
						if ( inner && typeof inner === 'object' && inner.type ) {
							if ( inner.type.charAt( 0 ) === '/' ) {
								depth--;
							} else {
								depth++;
							}
						}
						j++;
					}
					j--; // while後のj++で一つ進みすぎるのを補正
				}
				// 閉じ要素単体（depth管理なしで来た場合）はそのまま skip
			}
		}

		// ノード末尾の残りチャンク
		if ( curText.length ) {
			chunks.push( { text: curText, offsetMap: curMap } );
		}

		// 各チャンクに独立して findMath を適用
		chunks.forEach( function ( chunk ) {
			var mathItems = findRawMath( chunk.text );
			if ( !mathItems || !mathItems.length ) {
				return;
			}

			mathItems.forEach( function ( mi ) {
				if ( mi.display === null ) {
					return;
				}

				var startIdx = mi.start.n;
				var endIdx = mi.end.n - 1;

				if ( startIdx >= chunk.offsetMap.length ||
					endIdx >= chunk.offsetMap.length ) {
					return;
				}

				var dmStart = chunk.offsetMap[ startIdx ];
				var dmEnd = chunk.offsetMap[ endIdx ];
				if ( dmStart === null || dmEnd === null ) {
					return;
				}

				// FindTeXの返値（open/close）から Delim オブジェクトを作る
				// \begin...\end の場合は open/close が空文字列になる
				var delim = ve.smj.Delim.fromAttrs( {
					delimOpen: mi.open || '',
					delimClose: mi.close || ''
				} );

				replacements.push( {
					rangeStart: dmStart,
					rangeEnd: dmEnd + 1,
					latex: mi.math,
					delim: delim
				} );
			} );
		} );

		i = nodeRange.end + 1;
	}

	return replacements;
}

// ----------------------------------------------------------------
// 置換を実行する
// ----------------------------------------------------------------
function applyReplacements( surfaceModel, dmDoc, replacements ) {
	if ( !replacements.length ) {
		return;
	}

	// 後ろから順に処理（前を変更するとオフセットがずれるため）
	replacements.slice().reverse().forEach( function ( rep ) {
		var delimAttrs = ve.smj.Delim.toAttrs( rep.delim );

		var insertData = [
			{
				type: 'smjRawMath',
				attributes: Object.assign( { latex: rep.latex }, delimAttrs )
			},
			{ type: '/smjRawMath' }
		];

		var tx = ve.dm.TransactionBuilder.static.newFromReplacement(
			dmDoc,
			new ve.Range( rep.rangeStart, rep.rangeEnd ),
			insertData
		);

		surfaceModel.change( tx );
	} );
}

// ----------------------------------------------------------------
// フック登録
// ----------------------------------------------------------------
mw.hook( 've.activationComplete' ).add( function () {
	var target = ve.init.target;
	if ( !target ) {
		return;
	}

	var surface = target.getSurface();
	if ( !surface ) {
		return;
	}

	var surfaceModel = surface.getModel();
	var dmDoc = surfaceModel.getDocument();

	// MathJax が確実に初期化済みか確認
	// （MathJax.startup.promise が resolve 済みであることを期待）
	var mjReady = window.MathJax && MathJax.startup && MathJax.startup.promise ?
		MathJax.startup.promise :
		Promise.resolve();

	mjReady.then( function () {
		var replacements = collectReplacements( dmDoc );

		if ( !replacements.length ) {
			mw.log( '[SMJRawMath] no raw math found in document' );
			return;
		}

		mw.log( '[SMJRawMath] found', replacements.length, 'raw math items' );
		applyReplacements( surfaceModel, dmDoc, replacements );

	} ).catch( function ( e ) {
		mw.log.warn( '[SMJRawMath] setup error:', e );
	} );

} );

}() );
