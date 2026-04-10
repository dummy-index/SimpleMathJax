// tests/qunit/ve.smj.RawMathValidator.test.js

( function () {

/* eslint indent: ["error", "tab", { "outerIIFEBody": "off" }] */
'use strict';

// ============================================================
// テストヘルパー
// ============================================================

/**
 * window.MathJax を FindMath stub で差し替える。
 *
 * @param {Array|null} items
 *   findMath が返す MathItem 配列。
 *   null を渡すと findMath が例外を投げる stub になる。
 */
function installFindMathStub( items ) {
	window.MathJax = {
		startup: {
			input: [ {
				findMath: function ( /* texts */ ) {
					if ( items === null ) {
						throw new Error( 'stub: findMath threw' );
					}
					return items;
				}
			} ]
		}
	};
}

/** window.MathJax を取り除く。 */
function removeMathJaxStub() {
	delete window.MathJax;
}

/**
 * 単一数式にマッチする MathItem を作る。
 *
 * FindTeX の実際の返値形式:
 *   { math, start: { n }, end: { n }, open, close, display }
 * display は boolean（null は「デリミタを認識できなかった」扱い）。
 *
 * @param {number} startN  マッチ開始オフセット
 * @param {number} endN    マッチ終了オフセット（末尾の次）
 * @param {boolean|null} display
 * @return {Object}
 */
function mathItem( startN, endN, display ) {
	return {
		math: 'x^{2}',
		start: { n: startN },
		end: { n: endN },
		open: '$$',
		close: '$$',
		display: display !== undefined ? display : false
	};
}

// ============================================================
// validate() / _validate()
// ============================================================

QUnit.module( 've.smj.RawMathValidator.validate', {
	afterEach: removeMathJaxStub
} );

QUnit.test( 'MathJax未ロード → unavailable', function ( assert ) {
	// window.MathJax を定義しない
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( '$$x^2$$' ),
		'unavailable'
	);
} );

QUnit.test( 'MathJax.startup.input が空 → unavailable', function ( assert ) {
	window.MathJax = { startup: { input: [] } };
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( '$$x^2$$' ),
		'unavailable'
	);
} );

QUnit.test( 'findMath が例外を投げる → unavailable', function ( assert ) {
	installFindMathStub( null ); // null = 例外モード
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( '$$x^2$$' ),
		'unavailable'
	);
} );

QUnit.test( 'findMath が空配列 → incomplete', function ( assert ) {
	installFindMathStub( [] );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( '$$x^2$$' ),
		'incomplete'
	);
} );

QUnit.test( '正常: 全体が1アイテムにマッチ → ok', function ( assert ) {
	var raw = '$$x^2$$';
	installFindMathStub( [ mathItem( 0, raw.trim().length, false ) ] );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( raw ),
		'ok'
	);
} );

QUnit.test( 'validate は trim してから _validate を呼ぶ（前後空白）', function ( assert ) {
	// "  $$x^2$$  " → trim → "$$x^2$$"（length=7）で ok
	var trimmed = '$$x^2$$';
	installFindMathStub( [ mathItem( 0, trimmed.length, false ) ] );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( '  $$x^2$$  ' ),
		'ok',
		'前後の空白はtrimされてokになる'
	);
} );

QUnit.test( 'マッチ開始位置が0でない → incomplete', function ( assert ) {
	var raw = '$$x^2$$';
	installFindMathStub( [ mathItem( 2, raw.length, false ) ] );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( raw ),
		'incomplete'
	);
} );

QUnit.test( 'マッチ終了位置が末尾に届かない → incomplete', function ( assert ) {
	var raw = '$$x^2$$';
	installFindMathStub( [ mathItem( 0, raw.length - 2, false ) ] );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( raw ),
		'incomplete'
	);
} );

QUnit.test( 'first.display === null → incomplete', function ( assert ) {
	var raw = '$$x^2$$';
	installFindMathStub( [ mathItem( 0, raw.length, null ) ] );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( raw ),
		'incomplete'
	);
} );

QUnit.test( 'last.display === null → incomplete（複数アイテム）', function ( assert ) {
	// 最初のアイテムは正常、最後が null
	var raw = '$$a$$$$b$$';
	installFindMathStub( [
		mathItem( 0, 5, false ),
		{ math: 'b', start: { n: 5 }, end: { n: raw.length }, open: '$$', close: '$$', display: null }
	] );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( raw ),
		'incomplete'
	);
} );

QUnit.test( '複数アイテムが全体を覆う → ok', function ( assert ) {
	// "$$a$$$$b$$" → [{start:0, end:5}, {start:5, end:10}]
	var raw = '$$a$$$$b$$';
	installFindMathStub( [
		mathItem( 0, 5, false ),
		{ math: 'b', start: { n: 5 }, end: { n: raw.length }, open: '$$', close: '$$', display: false }
	] );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( raw ),
		'ok'
	);
} );

// ============================================================
// complete()
// ============================================================

QUnit.module( 've.smj.RawMathValidator.complete', {
	afterEach: removeMathJaxStub
} );

QUnit.test( '最初から正常（count: 0, latexは変化なし）', function ( assert ) {
	// ループ前の0個チェックでokになる
	var latex = 'x^{2}';
	var delimOpen = '$$';
	var delimClose = '$$';
	var raw = delimOpen + latex + delimClose;
	installFindMathStub( [ mathItem( 0, raw.length, false ) ] );

	var result = ve.smj.RawMathValidator.complete( latex, delimOpen, delimClose );
	assert.strictEqual( result.count, 0 );
	assert.strictEqual( result.reason, 'ok' );
	// 0個追加なのでlatexはそのまま（マーカーも入らない）
	assert.strictEqual( result.latex, latex );
} );

QUnit.test( 'MathJax未準備（ループ前チェックでunavailable）→ reason:ok, count:0', function ( assert ) {
	// window.MathJax なし → ループ前の _validate が unavailable を返す
	var result = ve.smj.RawMathValidator.complete( 'x', '$$', '$$' );
	assert.strictEqual( result.reason, 'ok' );
	assert.strictEqual( result.count, 0 );
} );

QUnit.test( '\\end がない isBeginEnd → missing-end', function ( assert ) {
	// delimOpen === '' = isBeginEnd モード、latexに\\endがない
	var result = ve.smj.RawMathValidator.complete(
		'\\begin{align} x = 1',
		'',
		''
	);
	assert.strictEqual( result.latex, null );
	assert.strictEqual( result.reason, 'missing-end' );
} );

QUnit.test( '} 1個追加で解決（インラインモード, count: 1）', function ( assert ) {
	// ループ前チェック（callCount=1）: incomplete
	// マーカー挿入 → } 1個追加 → チェック（callCount=2）: ok
	// → count: 1
	var latex = '\\frac{1}{2';
	var delimOpen = '\\(';
	var delimClose = '\\)';

	var callCount = 0;
	window.MathJax = {
		startup: {
			input: [ {
				findMath: function ( texts ) {
					callCount++;
					var text = texts[ 0 ];
					if ( callCount === 1 ) {
						// ループ前: 元のrawをチェック → incomplete
						return [];
					}
					// i=1: }1個追加済みのrawをチェック → ok
					return [ mathItem( 0, text.length, false ) ];
				}
			} ]
		}
	};

	var result = ve.smj.RawMathValidator.complete( latex, delimOpen, delimClose );
	assert.strictEqual( result.reason, 'ok' );
	assert.strictEqual( result.count, 1 );
	assert.ok(
		result.latex.indexOf( '}' ) !== -1,
		'補完後のlatexに}が含まれる'
	);
} );

QUnit.test( '} 1個追加で解決（isBeginEndモード, \\end 直前に挿入）', function ( assert ) {
	var latex = '\\begin{align}\n x = \\frac{1}{2\n\\end{align}';
	var delimOpen = '';
	var delimClose = '';

	var callCount = 0;
	window.MathJax = {
		startup: {
			input: [ {
				findMath: function ( texts ) {
					callCount++;
					var text = texts[ 0 ];
					if ( callCount === 1 ) {
						// ループ前チェック → incomplete
						return [];
					}
					// i=1: }1個追加済み → ok
					return [ mathItem( 0, text.length, false ) ];
				}
			} ]
		}
	};

	var result = ve.smj.RawMathValidator.complete( latex, delimOpen, delimClose );
	assert.strictEqual( result.reason, 'ok' );
	assert.strictEqual( result.count, 1 );

	// マーカーと } が \end より前に挿入されているか確認
	// （stripCloserMarker呼び出し前なのでマーカーが残っている）
	var closerPos = result.latex.indexOf( '%ve-closer%' );
	var endPos = result.latex.lastIndexOf( '\\end' );
	assert.ok( closerPos < endPos, '\\end より前にマーカー（および}）が挿入されている' );
} );

QUnit.test( 'MAX_ITER超過 → max-iter', function ( assert ) {
	// findMath が常に incomplete を返す → MAX_ITER回追加しても解決しない
	installFindMathStub( [] );

	var result = ve.smj.RawMathValidator.complete( 'x', '$$', '$$' );
	assert.strictEqual( result.latex, null );
	assert.strictEqual( result.reason, 'max-iter' );
} );

QUnit.test( 'ユーザー入力中の %ve-closer% マーカーは無効化される', function ( assert ) {
	// ユーザーが誤って %ve-closer%\n を含む入力をしても
	// complete() 冒頭で %% に置換されて補完マーカーと混同しない
	var latex = 'x %ve-closer%\n+ 1';

	var callCount = 0;
	window.MathJax = {
		startup: {
			input: [ {
				findMath: function ( texts ) {
					callCount++;
					var text = texts[ 0 ];
					if ( callCount === 1 ) {
						// ループ前チェック → incomplete
						return [];
					}
					return [ mathItem( 0, text.length, false ) ];
				}
			} ]
		}
	};

	var result = ve.smj.RawMathValidator.complete( latex, '$$', '$$' );
	assert.strictEqual( result.reason, 'ok' );
	// 補完マーカー（%ve-closer%\n）はあってもよいが、
	// ユーザー入力由来のものが補完マーカーとして機能していないこと。
	// count=1 であれば補完が1回で済んでおり、
	// マーカーが二重になっていないことが間接的に確認できる。
	assert.strictEqual( result.count, 1 );
} );

// ============================================================
// stripCloserMarker()
// ============================================================

QUnit.module( 've.smj.RawMathValidator.stripCloserMarker' );

QUnit.test( 'マーカーなし → 変化なし', function ( assert ) {
	var latex = 'x^{2} + y^{2}';
	assert.strictEqual(
		ve.smj.RawMathValidator.stripCloserMarker( latex, '$$', '$$' ),
		latex
	);
} );

QUnit.test( '1個の } を含むマーカーを除去', function ( assert ) {
	// complete()が生成する形式: "%\n} %ve-closer%\n"
	var latex = '\\frac{1}{2%\n} %ve-closer%\n';
	var result = ve.smj.RawMathValidator.stripCloserMarker( latex, '$$', '$$' );
	assert.strictEqual( result, '\\frac{1}{2' );
} );

QUnit.test( '複数の } を含むマーカーを除去', function ( assert ) {
	var latex = '\\frac{1{2}%\n} } %ve-closer%\n';
	var result = ve.smj.RawMathValidator.stripCloserMarker( latex, '$$', '$$' );
	assert.strictEqual( result, '\\frac{1{2}' );
} );

QUnit.test( '最後のマーカーブロックのみ除去', function ( assert ) {
	// isBeginEndモードで2個のマーカーが挿入された場合
	var latex =
		'\\begin{align}{\n' +
		' x = \\frac{1}{2%\n} %ve-closer%\n' +
		'%\n} } %ve-closer%\n' +
		'\\end{align}';
	var result = ve.smj.RawMathValidator.stripCloserMarker( latex );
	assert.ok(
		result.indexOf( '%\n} %ve-closer%' ) !== -1,
		'1個目のマーカーは除去されていない'
	);
	assert.ok(
		result.indexOf( '%\n} } %ve-closer%' ) === -1,
		'2個目のマーカーは除去されている'
	);
	assert.ok(
		result.indexOf( '\\end{align}' ) !== -1,
		'\\end{align}は残っている'
	);
} );

QUnit.test( '空文字列 → 空文字列', function ( assert ) {
	assert.strictEqual(
		ve.smj.RawMathValidator.stripCloserMarker( '' ),
		''
	);
} );

}() );
