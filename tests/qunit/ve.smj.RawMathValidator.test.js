// tests/qunit/ve.smj.RawMathValidator.test.js

( function () {

/* eslint indent: ["error", "tab", { "outerIIFEBody": "off" }] */
'use strict';

// ============================================================
// Test helpers
// ============================================================

/**
 * Install a findMath stub into ve.smj.RawMathValidator._testInputJax.
 *
 * @param {Array|null} items
 *   MathItem array returned by the findMath stub.
 *   When items is null, findMath throws an exception.
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
 * Build a MathItem matching a single expression.
 *
 * The actual return value format of findMath:
 *   { math, start: { n }, end: { n }, open, close, display }
 * display is boolean; null is '\\$' with '$' escaped, etc. Not handled in ve-smj-raw.
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

// Commonly used Delim objects
var DELIM_DOLLAR = ve.smj.Delim.delim( '$$', '$$' );
var DELIM_PAREN = ve.smj.Delim.delim( '\\(', '\\)' );
var DELIM_BEGIN = ve.smj.Delim.beginEnd();

// ============================================================
// ve.smj.Delim
// ============================================================

QUnit.module( 've.smj.Delim' );

QUnit.test( 'fromAttrs: empty strings → beginEnd', function ( assert ) {
	var d = ve.smj.Delim.fromAttrs( { delimOpen: '', delimClose: '' } );
	assert.strictEqual( d.type, 'beginEnd' );
} );

QUnit.test( 'fromAttrs: missing attributes → beginEnd', function ( assert ) {
	var d = ve.smj.Delim.fromAttrs( {} );
	assert.strictEqual( d.type, 'beginEnd' );
} );

QUnit.test( 'fromAttrs: $$ → delim', function ( assert ) {
	var d = ve.smj.Delim.fromAttrs( { delimOpen: '$$', delimClose: '$$' } );
	assert.strictEqual( d.type, 'delim' );
	assert.strictEqual( d.open, '$$' );
	assert.strictEqual( d.close, '$$' );
} );

QUnit.test( 'toAttrs / fromAttrs round-trip', function ( assert ) {
	[ DELIM_DOLLAR, DELIM_PAREN, DELIM_BEGIN ].forEach( function ( d ) {
		var attrs = ve.smj.Delim.toAttrs( d );
		var d2 = ve.smj.Delim.fromAttrs( attrs );
		assert.strictEqual( d2.type, d.type, 'type matches: ' + d.type );
	} );
} );

QUnit.test( 'fromKey / toKey round-trip', function ( assert ) {
	[ 'begin-end', 'dollar-block', 'paren', 'bracket' ].forEach( function ( key ) {
		assert.strictEqual(
			ve.smj.Delim.toKey( ve.smj.Delim.fromKey( key ) ),
			key,
			key
		);
	} );
} );

QUnit.test( 'buildRaw: delim mode → open + latex + close', function ( assert ) {
	assert.strictEqual(
		ve.smj.Delim.buildRaw( DELIM_DOLLAR, 'x^2' ),
		'$$x^2$$'
	);
} );

QUnit.test( 'buildRaw: beginEnd mode → trim only', function ( assert ) {
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

QUnit.test( 'MathJax not loaded → unavailable', function ( assert ) {
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( 'x^2', DELIM_DOLLAR ),
		'unavailable'
	);
} );

QUnit.test( 'findMath throws → unavailable', function ( assert ) {
	setFindMathStub( null );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( 'x^2', DELIM_DOLLAR ),
		'unavailable'
	);
} );

QUnit.test( 'findMath returns empty array → incomplete', function ( assert ) {
	setFindMathStub( [] );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( 'x^2', DELIM_DOLLAR ),
		'incomplete'
	);
} );

QUnit.test( 'single item covering full input → ok', function ( assert ) {
	var raw = '$$x^2$$';
	setFindMathStub( [ mathItem( 0, raw.length, false ) ] );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( 'x^2', DELIM_DOLLAR ),
		'ok'
	);
} );

QUnit.test( 'beginEnd: match length is measured after trim', function ( assert ) {
	// buildRaw trims, so "  \begin{x}\end{x}  " → "\begin{x}\end{x}"
	var trimmed = '\\begin{x}\\end{x}';
	setFindMathStub( [ mathItem( 0, trimmed.length, false ) ] );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( '  \\begin{x}\\end{x}  ', DELIM_BEGIN ),
		'ok'
	);
} );

QUnit.test( 'match starts after position 0 → incomplete', function ( assert ) {
	var raw = '$$x^2$$';
	setFindMathStub( [ mathItem( 2, raw.length, false ) ] );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( 'x^2', DELIM_DOLLAR ),
		'incomplete'
	);
} );

QUnit.test( 'match ends before end of input → incomplete', function ( assert ) {
	var raw = '$$x^2$$';
	setFindMathStub( [ mathItem( 0, raw.length - 2, false ) ] );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( 'x^2', DELIM_DOLLAR ),
		'incomplete'
	);
} );

QUnit.test( 'first item display === null → incomplete', function ( assert ) {
	var raw = '$$x^2$$';
	setFindMathStub( [ mathItem( 0, raw.length, null ) ] );
	assert.strictEqual(
		ve.smj.RawMathValidator.validate( 'x^2', DELIM_DOLLAR ),
		'incomplete'
	);
} );

QUnit.test( 'last item display === null → incomplete (multiple items)', function ( assert ) {
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

QUnit.test( 'multiple items covering full input → ok', function ( assert ) {
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

QUnit.test( 'already valid (count: 0, latex unchanged)', function ( assert ) {
	var latex = 'x^{2}';
	var raw = ve.smj.Delim.buildRaw( DELIM_DOLLAR, latex );
	setFindMathStub( [ mathItem( 0, raw.length, false ) ] );

	var result = ve.smj.RawMathValidator.complete( latex, DELIM_DOLLAR );
	assert.strictEqual( result.count, 0 );
	assert.strictEqual( result.reason, 'ok' );
	assert.strictEqual( result.latex, latex );
} );

QUnit.test( 'MathJax not ready (unavailable on pre-loop check) → reason: ok, count: 0', function ( assert ) {
	var result = ve.smj.RawMathValidator.complete( 'x', DELIM_DOLLAR );
	assert.strictEqual( result.reason, 'ok' );
	assert.strictEqual( result.count, 0 );
} );

QUnit.test( 'beginEnd with no \\end → missing-end', function ( assert ) {
	var result = ve.smj.RawMathValidator.complete(
		'\\begin{align} x = 1',
		DELIM_BEGIN
	);
	assert.strictEqual( result.latex, null );
	assert.strictEqual( result.reason, 'missing-end' );
} );

QUnit.test( 'one } inserted to fix (delim mode, count: 1)', function ( assert ) {
	// pre-loop check (callCount=1): incomplete
	// insert marker → add one } → check (callCount=2): ok
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

	var result = ve.smj.RawMathValidator.complete( 'x^{2', DELIM_PAREN );
	assert.strictEqual( result.reason, 'ok' );
	assert.strictEqual( result.count, 1 );
	assert.ok(
		result.latex.indexOf( '}' ) !== -1,
		'completed latex contains }'
	);
} );

QUnit.test( 'one } inserted before \\end (beginEnd mode, count: 1)', function ( assert ) {
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
	assert.ok( closerPos < endPos, 'marker (and }) is inserted before \\end' );
} );

QUnit.test( 'MAX_ITER exceeded → max-iter', function ( assert ) {
	setFindMathStub( [] );
	var result = ve.smj.RawMathValidator.complete( 'x', DELIM_DOLLAR );
	assert.strictEqual( result.latex, null );
	assert.strictEqual( result.reason, 'max-iter' );
} );

QUnit.test( 'user-supplied %ve-closer% marker is neutralized', function ( assert ) {
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
	// If neutralized, exactly one completion marker remains in latex
	var markerCount = ( result.latex.match( /%ve-closer%\n/g ) || [] ).length;
	assert.strictEqual( markerCount, 1, 'exactly one completion marker (user input neutralized)' );
} );

// ============================================================
// ve.smj.RawMathValidator.stripCloserMarker()
// ============================================================

QUnit.module( 've.smj.RawMathValidator.stripCloserMarker' );

QUnit.test( 'no marker → unchanged (delim mode)', function ( assert ) {
	var latex = 'x^{2} + y^{2}';
	assert.strictEqual(
		ve.smj.RawMathValidator.stripCloserMarker( latex, DELIM_DOLLAR ),
		latex
	);
} );

QUnit.test( 'trailing single-} marker removed (delim mode)', function ( assert ) {
	// format produced by complete(): latex + "%\n} %ve-closer%\n"
	var latex = '\\frac{1}{2%\n} %ve-closer%\n';
	var result = ve.smj.RawMathValidator.stripCloserMarker( latex, DELIM_DOLLAR );
	assert.strictEqual( result, '\\frac{1}{2' );
} );

QUnit.test( 'trailing multi-} marker removed (delim mode)', function ( assert ) {
	var latex = '\\frac{1{2}%\n} } %ve-closer%\n';
	var result = ve.smj.RawMathValidator.stripCloserMarker( latex, '$$', '$$' );
	assert.strictEqual( result, '\\frac{1{2}' );
} );

QUnit.test( 'non-trailing marker is left intact (delim mode)', function ( assert ) {
	// non-trailing marker is treated as user input and left for neutralization
	var latex = 'x%\n} %ve-closer%\n+ y%\n} %ve-closer%\n';
	var result = ve.smj.RawMathValidator.stripCloserMarker( latex, DELIM_DOLLAR );
	// only the trailing one is removed
	assert.strictEqual( result, 'x%\n} %ve-closer%\n+ y' );
} );

QUnit.test( 'marker before \\end removed (beginEnd mode)', function ( assert ) {
	var latex =
		'\\begin{align}\n' +
		' x = \\frac{1}{2%\n} %ve-closer%\n' +
		'\\end{align}';
	var result = ve.smj.RawMathValidator.stripCloserMarker( latex, DELIM_BEGIN );
	assert.ok( result.indexOf( '%ve-closer%' ) === -1, 'marker removed' );
	assert.ok( result.indexOf( '\\end{align}' ) !== -1, '\\end{align} preserved' );
} );

QUnit.test( 'only the last marker block removed (beginEnd mode, two markers)', function ( assert ) {
	// two markers present: first is left intact, second (before \end) is removed
	var latex =
		'\\begin{align}{\n' +
		' x = \\frac{1}{2%\n} %ve-closer%\n' +
		'%\n} } %ve-closer%\n' +
		'\\end{align}';
	var result = ve.smj.RawMathValidator.stripCloserMarker( latex, DELIM_BEGIN );
	assert.ok(
		result.indexOf( '%\n} %ve-closer%' ) !== -1,
		'first marker is not removed'
	);
	assert.ok(
		result.indexOf( '%\n} } %ve-closer%' ) === -1,
		'second marker (before \\end) is removed'
	);
	assert.ok(
		result.indexOf( '\\end{align}' ) !== -1,
		'\\end{align} preserved'
	);
} );

QUnit.test( 'no marker → unchanged (beginEnd mode)', function ( assert ) {
	var latex = '\\begin{align} x \\end{align}';
	assert.strictEqual(
		ve.smj.RawMathValidator.stripCloserMarker( latex, DELIM_BEGIN ),
		latex
	);
} );

QUnit.test( 'empty string → empty string', function ( assert ) {
	assert.strictEqual(
		ve.smj.RawMathValidator.stripCloserMarker( '', DELIM_DOLLAR ),
		''
	);
} );

}() );
