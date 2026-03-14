/*!
 * VisualEditor ContentEditable SMJMathNode class.
 *
 * @license MIT
 */

/**
 * ContentEditable MediaWiki math node for SimpleMathJax.
 *
 * Overrides generateContents() to render LaTeX locally via MathJax
 * instead of sending a request to the MediaWiki parse API.
 *
 * @class
 * @extends ve.ce.MWInlineExtensionNode
 *
 * @constructor
 * @param {ve.dm.SMJMathNode} model Model to observe
 * @param {Object} [config] Configuration options
 */
ve.ce.SMJMathNode = function VeCeSMJMathNode() {
	// Parent constructor
	ve.ce.SMJMathNode.super.apply( this, arguments );

	// DOM changes
	this.$element.addClass( 've-ce-smjMathNode' );
};

/* Inheritance */

OO.inheritClass( ve.ce.SMJMathNode, ve.ce.MWInlineExtensionNode );

/* Static Properties */

ve.ce.SMJMathNode.static.name = 'smjMath';

ve.ce.SMJMathNode.static.primaryCommandName = 'smjMathInspector';

ve.ce.SMJMathNode.static.iconWhenInvisible = 'mathematics';

/* Methods */

/**
 * @inheritdoc
 */
ve.ce.SMJMathNode.prototype.update = function ( config, staged ) {
	if ( !this.smjInitialized ) {
		this.smjInitialized = true;
		this.forceUpdate();
	} else {
		ve.ce.SMJMathNode.super.prototype.update.call( this, config, staged );
	}
};

/**
 * @inheritdoc ve.ce.GeneratedContentNode
 *
 * Renders the LaTeX source locally using MathJax instead of the parse API.
 *
 * display attribute values:
 *   'block'   → $$...$$ (display math)
 *   'inline'  → [math]...[/math] (inline math, explicit)
 *   'default' or absent → [math]\displaystyle{...}[/math] (inline math, default)
 *
 * @param {Object} [config]
 * @param {string} [config.extsrc] Override LaTeX source
 * @param {Object} [config.attrs] Override tag attributes
 * @return {jQuery.Promise}
 */
ve.ce.SMJMathNode.prototype.generateContents = function ( config ) {
	console.log('generateContents called', this.getModel().getAttribute('mw'));
	const deferred = ve.createDeferred();
	const mwData = ve.copy( this.getModel().getAttribute( 'mw' ) );
	const extsrc = config && config.extsrc !== undefined
		? config.extsrc
		: ( ve.getProp( mwData, 'body', 'extsrc' ) || '' );
	const attrs = ( config && config.attrs ) || mwData.attrs || {};
	const display = attrs.display;

	// Empty content: render a non-breaking space placeholder
	if ( extsrc.trim() === '' ) {
		deferred.resolve( $( '<span>' ).text( '\u00a0' ).get() );
		return deferred.promise();
	}

	// Wrap LaTeX in appropriate delimiters based on display attribute
	let wrapped;
	if ( display === 'block' ) {
		wrapped = '\\begin{displaymjx}' + extsrc + '\n\\end{displaymjx}';
	} else if ( display === 'inline' ) {
		wrapped = '[math]' + extsrc + '[/math]';
	} else if ( display === undefined && mw.config.get('wgSmjPreloadChem') ){
		wrapped = '[math]\\displaystyle{' + extsrc + '\n}[/math]';
	} else {
		wrapped = '[math]' + extsrc + '[/math]';
	}

	const $container = $( '<span>' ).text( wrapped );
	const container = $container.get( 0 );

	// Render via MathJax (already loaded on the page by SimpleMathJax)
	if ( typeof MathJax !== 'undefined' && MathJax.typesetPromise ) {
		MathJax.typesetPromise( [ container ] ).then( function () {
			deferred.resolve( [ container ] );
		} ).catch( function () {
			// Fall back to raw LaTeX text on error
			deferred.resolve( $( '<span>' ).addClass( 'error' ).text( extsrc ).get() );
		} );
	} else {
		// MathJax not available: show raw source so content is not lost
		deferred.resolve( $( '<span>' ).addClass( 'error' ).text( extsrc ).get() );
	}

	return deferred.promise();
};

/**
 * @inheritdoc ve.ce.GeneratedContentNode
 *
 * MathJax rendering does not involve img elements that load asynchronously,
 * so the img-load resize logic from MWExtensionNode is not needed.
 */
ve.ce.SMJMathNode.prototype.afterRender = function () {
	ve.ce.GeneratedContentNode.prototype.afterRender.call( this );
};

/**
 * @inheritdoc ve.ce.MWLatexNode
 */
ve.ce.SMJMathNode.prototype.validateGeneratedContents = function ( $element ) {
	return !( $element.find( '.error' ).addBack( '.error' ).length );
};

/* Registration */

ve.ce.nodeFactory.register( ve.ce.SMJMathNode );
