// tests/qunit/ve.smj.RawMathValidator.test.js

( function () {

/* eslint indent: ["error", "tab", { "outerIIFEBody": "off" }] */
'use strict';

// ============================================================
// テストヘルパー
// ============================================================

/**
 * ve.smj.RawMathValidator._testInputJax に findMath stub を差し込む。
 *
 * @param {Array|null} items
 *   findMath が返す MathItem 配列。
 *   null を渡すと findMath が例外を投げる stub になる。
 */
function setFindMathStub( items ) {
	ve.smj.RawMathValidator._testInputJax = {
		findMath: function ( /* texts */ ) {
			if ( items === null ) {
				throw new Error( 'stub: findMath threw' );
			}
			return items;
		}
	};
}

function clearFindMathStub() {
	ve.smj.RawMathValidator._testInputJax = null;
}

/**
 * 単一数式にマッチする MathItem を作る。
 *
 * FindTeX の実際の返値形式:
 *   { math, start: { n }, end: { n }, open, close, display }
 * display は boolean（null は '$' のエスケープ等。ve-smj-rawでは扱わない）。
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

// よく使う Delim オブジェクト
var DELIM_DOLLAR = ve.smj.Delim.delim( '$$', '$$' );
var DELIM_PAREN = ve.smj.Delim.delim( '\\(', '\\)' );
var DELIM_BEGIN = ve.smj.Delim.beginEnd();

// ============================================================
// ve.smj.Delim
// ============================================================

QUnit.module( 've.smj.Delim' );

QUnit.test( 'fromAttrs: 空文字列 → beginEnd', function ( assert ) {
	var d = ve.smj.Delim.fromAttrs( { delimOpen: '', delimClose: '' } );
	assert.strictEqual( d.type, 'beginEnd' );
} );

QUnit.test( 'fromAttrs: 属性なし → beginEnd', function ( assert ) {
	var d = ve.smj.Delim.fromAttrs( {} );
	assert.strictEqual( d.type, 'beginEnd' );
} );

QUnit.test( 'fromAttrs: $$ → delim', function ( assert ) {
	var d = ve.smj.Delim.fromAttrs( { delimOpen: '$$', delimClose: '$$' } );
	assert.strictEqual( d.type, 'delim' );
	assert.strictEqual( d.open, '$$' );
	assert.strictEqual( d.close, '$$' );
} );

QUnit.test( 'toAttrs / fromAttrs ラウンドトリップ', function ( assert ) {
	[ DELIM_DOLLAR, DELIM_PAREN, DELIM_BEGIN ].forEach( function ( d ) {
		var attrs = ve.smj.Delim.toAttrs( d );
		var d2 = ve.smj.Delim.fromAttrs( attrs );
		assert.strictEqual( d2.type, d.type, 'type が一致: ' + d.type );
	} );
} );

QUnit.test( 'fromKey / toKey ラウンドトリップ', function ( assert ) {
	[ 'begin-end', 'dollar-block', 'paren', 'bracket' ].forEach( function ( key ) {
		assert.strictEqual(
			ve.smj.Delim.toKey( ve.smj.Delim.fromKey( key ) ),
			key,
			key
		);
	} );
} );

QUnit.test( 'buildRaw: delim は open+latex+close', function ( assert ) {
	assert.strictEqual(
		ve.smj.Delim.buildRaw( DELIM_DOLLAR, 'x^2' ),
		'$$x^2$$'
	);
} );

QUnit.test( 'buildRaw: beginEnd は trim のみ', function ( assert ) {
	assert.strictEqual(
		ve.smj.Delim.buildRaw( DELIM_BEGIN, '  \\begin{align}x\\end{align}  ' ),
		'\\begin{align}x\\end{align}'
	);
} );

// ============================================================
// ve.smj.RawMathValidator.validate()
// ============================================================

QUnit.module( 've.smj.RawMathValidator.validate', {
	afterEach: clearFindMathStub
} );

QUnit.test( 'MathJax未ロード → unavailable', function ( assert ) {
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( 'x^2', DELIM_DOLLAR ),
		'unavailable'
	);
} );

QUnit.test( 'findMath が例外を投げる → unavailable', function ( assert ) {
	setFindMathStub( null );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( 'x^2', DELIM_DOLLAR ),
		'unavailable'
	);
} );

QUnit.test( 'findMath が空配列 → incomplete', function ( assert ) {
	setFindMathStub( [] );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( 'x^2', DELIM_DOLLAR ),
		'incomplete'
	);
} );

QUnit.test( '正常: 全体が1アイテムにマッチ → ok', function ( assert ) {
	var raw = '$$x^2$$';
	setFindMathStub( [ mathItem( 0, raw.length, false ) ] );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( 'x^2', DELIM_DOLLAR ),
		'ok'
	);
} );

QUnit.test( 'beginEnd: trim後の長さで判定される', function ( assert ) {
	// buildRaw が trim するので "  \begin{x}\end{x}  " → "\begin{x}\end{x}"
	var trimmed = '\\begin{x}\\end{x}';
	setFindMathStub( [ mathItem( 0, trimmed.length, false ) ] );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( '  \\begin{x}\\end{x}  ', DELIM_BEGIN ),
		'ok'
	);
} );

QUnit.test( 'マッチ開始位置が0でない → incomplete', function ( assert ) {
	var raw = '$$x^2$$';
	setFindMathStub( [ mathItem( 2, raw.length, false ) ] );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( 'x^2', DELIM_DOLLAR ),
		'incomplete'
	);
} );

QUnit.test( 'マッチ終了位置が末尾に届かない → incomplete', function ( assert ) {
	var raw = '$$x^2$$';
	setFindMathStub( [ mathItem( 0, raw.length - 2, false ) ] );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( 'x^2', DELIM_DOLLAR ),
		'incomplete'
	);
} );

QUnit.test( 'first.display === null → incomplete', function ( assert ) {
	var raw = '$$x^2$$';
	setFindMathStub( [ mathItem( 0, raw.length, null ) ] );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( 'x^2', DELIM_DOLLAR ),
		'incomplete'
	);
} );

QUnit.test( 'last.display === null → incomplete（複数アイテム）', function ( assert ) {
	// 最初のアイテムは正常、最後が null
	var raw = '$$a$$$$b$$';
	setFindMathStub( [
		mathItem( 0, 5, false ),
		{ math: 'b', start: { n: 5 }, end: { n: raw.length }, open: '$$', close: '$$', display: null }
	] );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( 'a$$$$b', DELIM_DOLLAR ),
		'incomplete'
	);
} );

QUnit.test( '複数アイテムが全体を覆う → ok', function ( assert ) {
	// "$$a$$$$b$$" → [{start:0, end:5}, {start:5, end:10}]
	var raw = '$$a$$$$b$$';
	setFindMathStub( [
		mathItem( 0, 5, false ),
		{ math: 'b', start: { n: 5 }, end: { n: raw.length }, open: '$$', close: '$$', display: false }
	] );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( 'a$$$$b', DELIM_DOLLAR ),
		'ok'
	);
} );

// ============================================================
// ve.smj.RawMathValidator.complete()
// ============================================================

QUnit.module( 've.smj.RawMathValidator.complete', {
	afterEach: clearFindMathStub
} );

QUnit.test( '最初から正常（count: 0, latexは変化なし）', function ( assert ) {
	// ループ前の0個チェックでokになる
	var latex = 'x^{2}';
	var raw = ve.smj.Delim.buildRaw( DELIM_DOLLAR, latex );
	setFindMathStub( [ mathItem( 0, raw.length, false ) ] );

	var result = ve.smj.RawMathValidator.complete( latex, DELIM_DOLLAR );
	assert.strictEqual( result.count, 0 );
	assert.strictEqual( result.reason, 'ok' );
	// 0個追加なのでlatexはそのまま（マーカーも入らない）
	assert.strictEqual( result.latex, latex );
} );

QUnit.test( 'MathJax未準備（ループ前チェックでunavailable）→ reason:ok, count:0', function ( assert ) {
	// window.MathJax なし → ループ前の _validate が unavailable を返す
	var result = ve.smj.RawMathValidator.complete( 'x', DELIM_DOLLAR );
	assert.strictEqual( result.reason, 'ok' );
	assert.strictEqual( result.count, 0 );
} );

QUnit.test( '\\end がない isBeginEnd → missing-end', function ( assert ) {
	var result = ve.smj.RawMathValidator.complete(
		'\\begin{align} x = 1',
		DELIM_BEGIN
	);
	assert.strictEqual( result.latex, null );
	assert.strictEqual( result.reason, 'missing-end' );
} );

QUnit.test( '} 1個追加で解決（delimモード, count: 1）', function ( assert ) {
	// ループ前チェック（callCount=1）: incomplete
	// マーカー挿入 → } 1個追加 → チェック（callCount=2）: ok
	// → count: 1
	var callCount = 0;
	ve.smj.RawMathValidator._testInputJax = {
		findMath: function ( texts ) {
			callCount++;
			var text = texts[ 0 ];
			if ( callCount === 1 ) {
				return [];
			}
			return [ mathItem( 0, text.length, false ) ];
		}
	};

	var result = ve.smj.RawMathValidator.complete( '\\frac{1}{2', DELIM_PAREN );
	assert.strictEqual( result.reason, 'ok' );
	assert.strictEqual( result.count, 1 );
	assert.ok(
		result.latex.indexOf( '}' ) !== -1,
		'補完後のlatexに}が含まれる'
	);
} );

QUnit.test( '} 1個追加で解決（isBeginEndモード, \\end 直前に挿入）', function ( assert ) {
	var callCount = 0;
	ve.smj.RawMathValidator._testInputJax = {
		findMath: function ( texts ) {
			callCount++;
			var text = texts[ 0 ];
			if ( callCount === 1 ) {
				return [];
			}
			return [ mathItem( 0, text.length, false ) ];
		}
	};

	var result = ve.smj.RawMathValidator.complete(
		'\\begin{align}\n x = \\frac{1}{2\n\\end{align}',
		DELIM_BEGIN
	);
	assert.strictEqual( result.reason, 'ok' );
	assert.strictEqual( result.count, 1 );

	var closerPos = result.latex.indexOf( '%ve-closer%' );
	var endPos = result.latex.lastIndexOf( '\\end' );
	assert.ok( closerPos < endPos, '\\end より前にマーカー（および}）が挿入されている' );
} );

QUnit.test( 'MAX_ITER超過 → max-iter', function ( assert ) {
	setFindMathStub( [] );
	var result = ve.smj.RawMathValidator.complete( 'x', DELIM_DOLLAR );
	assert.strictEqual( result.latex, null );
	assert.strictEqual( result.reason, 'max-iter' );
} );

QUnit.test( 'ユーザー入力中の %ve-closer% マーカーは無効化される', function ( assert ) {
	var callCount = 0;
	ve.smj.RawMathValidator._testInputJax = {
		findMath: function ( texts ) {
			callCount++;
			var text = texts[ 0 ];
			if ( callCount === 1 ) {
				return [];
			}
			return [ mathItem( 0, text.length, false ) ];
		}
	};

	var result = ve.smj.RawMathValidator.complete( 'x %ve-closer%\n+ 1', DELIM_DOLLAR );
	assert.strictEqual( result.reason, 'ok' );
	// 無効化されていれば %ve-closer%\n の直前に } が1個だけあるはず
	var markerCount = ( result.latex.match( /%ve-closer%\n/g ) || [] ).length;
	assert.strictEqual( markerCount, 1, '補完マーカーは1箇所だけ（ユーザー入力分は無効化済み）' );
} );

// ============================================================
// ve.smj.RawMathValidator.stripCloserMarker()
// ============================================================

QUnit.module( 've.smj.RawMathValidator.stripCloserMarker' );

QUnit.test( 'マーカーなし → 変化なし（delimモード）', function ( assert ) {
	var latex = 'x^{2} + y^{2}';
	assert.strictEqual(
		ve.smj.RawMathValidator.stripCloserMarker( latex, DELIM_DOLLAR ),
		latex
	);
} );

QUnit.test( '1個の } を含むマーカーを除去（delimモード）', function ( assert ) {
	// complete()が生成する形式: latex + "%\n} %ve-closer%\n"
	var latex = '\\frac{1}{2%\n} %ve-closer%\n';
	var result = ve.smj.RawMathValidator.stripCloserMarker( latex, DELIM_DOLLAR );
	assert.strictEqual( result, '\\frac{1}{2' );
} );

QUnit.test( '複数の } を含むマーカーを除去（delimモード）', function ( assert ) {
	var latex = '\\frac{1{2}%\n} } %ve-closer%\n';
	var result = ve.smj.RawMathValidator.stripCloserMarker( latex, '$$', '$$' );
	assert.strictEqual( result, '\\frac{1{2}' );
} );

QUnit.test( '末尾以外のマーカーは除去しない（delimモード）', function ( assert ) {
	// 末尾でないマーカーはユーザー入力由来とみなして残す
	var latex = 'x%\n} %ve-closer%\n+ y%\n} %ve-closer%\n';
	var result = ve.smj.RawMathValidator.stripCloserMarker( latex, DELIM_DOLLAR );
	// 末尾の1個だけ除去される
	assert.strictEqual( result, 'x%\n} %ve-closer%\n+ y' );
} );

QUnit.test( '\\end 直前のマーカーを除去（beginEndモード）', function ( assert ) {
	var latex =
		'\\begin{align}\n' +
		' x = \\frac{1}{2%\n} %ve-closer%\n' +
		'\\end{align}';
	var result = ve.smj.RawMathValidator.stripCloserMarker( latex, DELIM_BEGIN );
	assert.ok( result.indexOf( '%ve-closer%' ) === -1, 'マーカーが除去されている' );
	assert.ok( result.indexOf( '\\end{align}' ) !== -1, '\\end{align}は残っている' );
} );

QUnit.test( '最後のマーカーのみ除去（beginEndモード、マーカー2個）', function ( assert ) {
	// isBeginEndモードで2個のマーカーが挿入された場合
	var latex =
		'\\begin{align}{\n' +
		' x = \\frac{1}{2%\n} %ve-closer%\n' +
		'%\n} } %ve-closer%\n' +
		'\\end{align}';
	var result = ve.smj.RawMathValidator.stripCloserMarker( latex, DELIM_BEGIN );
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

QUnit.test( 'マーカーなし → 変化なし（beginEndモード）', function ( assert ) {
	var latex = '\\begin{align} x \\end{align}';
	assert.strictEqual(
		ve.smj.RawMathValidator.stripCloserMarker( latex, DELIM_BEGIN ),
		latex
	);
} );

QUnit.test( '空文字列 → 空文字列', function ( assert ) {
	assert.strictEqual(
		ve.smj.RawMathValidator.stripCloserMarker( '', DELIM_DOLLAR ),
		''
	);
} );

}() );
