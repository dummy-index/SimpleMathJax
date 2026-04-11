// ve.smj.Delim.js
//
// デリミタ型システム。
//
// デリミタには2種類ある:
//   { type: 'beginEnd' }
//     \begin{...}...\end{...} 形式。delimOpen/delimClose は空文字列で
//     rawSourceはlatex本体のtrimのみ。
//   { type: 'delim', open: string, close: string }
//     $$, \(\), \[\] 等のデリミタ形式。
//
// このオブジェクトを経由することで isBeginEnd の判定と || '' の処理が
// 各所に散らばることを防ぐ。

ve.smj = ve.smj || {};

ve.smj.Delim = {

	// ----------------------------------------------------------------
	// ファクトリ
	// ----------------------------------------------------------------

	/** @return {{ type: 'beginEnd' }} */
	beginEnd: function () {
		return { type: 'beginEnd' };
	},

	/**
	 * @param {string} open
	 * @param {string} close
	 * @return {{ type: 'delim', open: string, close: string }}
	 */
	delim: function ( open, close ) {
		return { type: 'delim', open: open, close: close };
	},

	// ----------------------------------------------------------------
	// DMの生属性 ↔ Delim オブジェクト
	// ----------------------------------------------------------------

	/**
	 * DMの attributes（delimOpen/delimClose）から Delim オブジェクトを作る。
	 * 属性が存在しない・null の場合も安全に扱う。
	 *
	 * @param {{ delimOpen?: string, delimClose?: string }} attrs
	 * @return {Object} Delim オブジェクト
	 */
	fromAttrs: function ( attrs ) {
		var open = attrs.delimOpen || '';
		var close = attrs.delimClose || '';
		if ( open === '' && close === '' ) {
			return { type: 'beginEnd' };
		}
		return { type: 'delim', open: open, close: close };
	},

	/**
	 * Delim オブジェクトから DM attributes を返す。
	 *
	 * @param {Object} delim
	 * @return {{ delimOpen: string, delimClose: string }}
	 */
	toAttrs: function ( delim ) {
		if ( delim.type === 'beginEnd' ) {
			return { delimOpen: '', delimClose: '' };
		}
		return { delimOpen: delim.open, delimClose: delim.close };
	},

	// ----------------------------------------------------------------
	// Inspector のドロップダウンキー ↔ Delim オブジェクト
	// ----------------------------------------------------------------

	/**
	 * ドロップダウンキーから Delim オブジェクトを返す。
	 *
	 * @param {string} key  'begin-end' | 'dollar-block' | 'paren' | 'bracket'
	 * @return {Object} Delim オブジェクト
	 */
	fromKey: function ( key ) {
		switch ( key ) {
			case 'dollar-block':
				return { type: 'delim', open: '$$', close: '$$' };
			case 'paren':
				return { type: 'delim', open: '\\(', close: '\\)' };
			case 'bracket':
				return { type: 'delim', open: '\\[', close: '\\]' };
			default:
				return { type: 'beginEnd' };
		}
	},

	/**
	 * Delim オブジェクトからドロップダウンキーを返す。
	 *
	 * @param {Object} delim
	 * @return {string}
	 */
	toKey: function ( delim ) {
		if ( delim.type === 'beginEnd' ) {
			return 'begin-end';
		}
		if ( delim.open === '$$' && delim.close === '$$' ) {
			return 'dollar-block';
		}
		if ( delim.open === '\\(' && delim.close === '\\)' ) {
			return 'paren';
		}
		if ( delim.open === '\\[' && delim.close === '\\]' ) {
			return 'bracket';
		}
		// 未知のデリミタはbegin-endにフォールバック
		return 'begin-end';
	},

	// ----------------------------------------------------------------
	// rawSource の組み立て
	// ----------------------------------------------------------------

	/**
	 * delim と latex から rawSource 文字列を組み立てる。
	 * beginEnd の場合は trim する（Parsoid往復で余分な改行が入るのを防ぐ）。
	 *
	 * @param {Object} delim
	 * @param {string} latex
	 * @return {string}
	 */
	buildRaw: function ( delim, latex ) {
		if ( delim.type === 'beginEnd' ) {
			return latex.trim();
		}
		return delim.open + latex + delim.close;
	}
};
