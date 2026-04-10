// ve.smj.RawMathValidator.js

ve.smj = ve.smj || {};

ve.smj.RawMathValidator = {

	// ----------------------------------------------------------------
	// FindTeX ヘルパー（ve.init.SMJRawMathSetup.js と共通化予定）
	// ----------------------------------------------------------------

	_getInputJax: function () {
		return window.MathJax &&
			MathJax.startup &&
			MathJax.startup.input &&
			MathJax.startup.input[ 0 ] || null;
	},

	// ----------------------------------------------------------------
	// 検証
	//
	// rawSource を trim 後 findMath にかけて、MathItemの開始位置が 0 かつ
	// 終了位置が rawSource.length に一致するかを確認する。
	//
	// @param  {string} rawSource  delimOpen + latex + delimClose
	// @return {string}  'ok' | 'incomplete' | 'unavailable'
	// ----------------------------------------------------------------
	validate: function ( rawSource ) {
		// FIXME: delimOpenの先頭がスペースな場合など（つまりMathJaxが
		// そう設定されていてそう切り出してきた）はそれをそのまま処理
		// しないといけない
		return this._validate( rawSource.trim() );
	},

	_validate: function ( rawSource ) {
		var inputJax = this._getInputJax();
		if ( !inputJax ) {
			return 'unavailable';
		}

		var items;
		try {
			items = inputJax.findMath( [ rawSource ] );
		} catch ( e ) {
			mw.log.warn( '[SMJRawMath] findMath error in validate:', e );
			return 'unavailable';
		}

		if ( !items || items.length === 0 ) {
			return 'incomplete';
		}

		var first = items[ 0 ];
		if ( first.display === null || first.start.n !== 0 ) {
			return 'incomplete';
		}

		var last = items[ items.length - 1 ];
		if ( last.display === null || last.end.n !== rawSource.length ) {
			return 'incomplete';
		}

		return 'ok';
	},

	// ----------------------------------------------------------------
	// 補完
	//
	// } を1個ずつ追加して validate が 'ok' になるまでループする。
	// 追加する波括弧はマーカーで挟む。
	//
	// \begin...\end の場合は \end の直前に挿入。
	// それ以外は latex の末尾に追加。
	//
	// @param  {string} latex
	// @param  {string} delimOpen
	// @param  {string} delimClose
	// @return {{ latex: string, count: number, reason: string }|{ latex: null, reason: string }}
	//         補完成功時は補完後のlatexと挿入した}の個数
	//         補完不能（\end消失等）の場合は null
	// ----------------------------------------------------------------
	complete: function ( latex, delimOpen, delimClose ) {
		var MAX_ITER = 20;
		var isBeginEnd = ( delimOpen === '' );
		// ユーザー入力がマーカーを含んでいると誤動作するため無効化
		var current = latex.replace( /%ve-closer%\n/g, '%%\n' );

		if ( isBeginEnd ) {
			current = current.trim();
			if ( !current.match( /\\end\s*{[^}]*}$/ ) ) {
				return { latex: null, reason: 'missing-end' };
			}
		}

		// 0個追加の状態でまず検証する
		var result = this._validate( delimOpen + current + delimClose );
		if ( result === 'ok' ) {
			return { latex: current, count: 0, reason: 'ok' };
		}
		if ( result === 'unavailable' ) {
			// MathJax未準備 → 補完できないが失敗でもない
			return { latex: current, count: 0, reason: 'ok' };
		}

		// } の挿入位置をマーカーで固定する（ループを通じて1回だけ）
		if ( isBeginEnd ) {
			var markerPos = current.lastIndexOf( '\\end' );
			current = current.slice( 0, markerPos ) +
					'%\n%ve-closer%\n' +
					current.slice( markerPos );
		} else {
			current = current + '%\n%ve-closer%\n';
		}

		// i = 追加した } の個数
		for ( var i = 1; i <= MAX_ITER; i++ ) {
			// } を1個挿入してから検証
			var closerPos = current.lastIndexOf( '%ve-closer%\n' );
			current = current.slice( 0, closerPos ) +
					'} ' +
					current.slice( closerPos );

			result = this._validate( delimOpen + current + delimClose );

			if ( result === 'ok' ) {
				return { latex: current, count: i, reason: 'ok' };
			}
			if ( result === 'unavailable' ) {
				return { latex: current, count: i, reason: 'ok' };
			}
		}

		// MAX_ITER 回試みて解決しなかった → 何か別の問題
		return { latex: null, reason: 'max-iter' };
	}
};

// マーカーとその中の } を取り除くヘルパー
ve.smj.RawMathValidator.stripCloserMarker = function ( latex, delimOpen = '' ) {
	var isBeginEnd = ( delimOpen === '' );
	if ( isBeginEnd ) {
		return latex.replace( /([\s\S]*)%\n[} ]+%ve-closer%\n(|\\end\s*{[^}]*})$/, '$1$2' );
	}
	return latex.replace( /%\n[} ]+%ve-closer%\n$/, '' );
};
