/*!
 * VisualEditor UserInterface SMJMathInspector class.
 *
 * @license MIT
 */

/**
 * Inspector for quick inline editing of <math> nodes in SimpleMathJax.
 *
 * Provides a minimal form: LaTeX textarea + display mode selector.
 * No symbol picker, no preview panel, no server requests.
 *
 * @class
 * @extends ve.ui.MWLiveExtensionInspector
 *
 * @constructor
 * @param {Object} [config] Configuration options
 */
ve.ui.SMJMathInspector = function VeUiSMJMathInspector( config ) {
	// Parent constructor
	ve.ui.SMJMathInspector.super.call( this, config );
};

/* Inheritance */

OO.inheritClass( ve.ui.SMJMathInspector, ve.ui.MWLiveExtensionInspector );

/* Static properties */

ve.ui.SMJMathInspector.static.name = 'smjMathInspector';

ve.ui.SMJMathInspector.static.title = OO.ui.deferMsg( 'simplemathJax-visualeditor-inspector-title' );

ve.ui.SMJMathInspector.static.modelClasses = [ ve.dm.SMJMathNode ];

ve.ui.SMJMathInspector.static.dir = 'ltr';

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.SMJMathInspector.prototype.initialize = function () {
	// Parent method (sets up this.input as a basic textarea)
	ve.ui.SMJMathInspector.super.prototype.initialize.call( this );

	// Display mode selector: default (inline-displaystyle) / inline / block
	this.displaySelect = new OO.ui.ButtonSelectWidget( {
		items: [
			new OO.ui.ButtonOptionWidget( {
				data: 'default',
				label: mw.msg( 'simplemathJax-visualeditor-display-default' )
			} ),
			new OO.ui.ButtonOptionWidget( {
				data: 'inline',
				label: mw.msg( 'simplemathJax-visualeditor-display-inline' )
			} ),
			new OO.ui.ButtonOptionWidget( {
				data: 'block',
				label: mw.msg( 'simplemathJax-visualeditor-display-block' )
			} )
		]
	} );

	const inputField = new OO.ui.FieldLayout( this.input, {
		align: 'top',
		label: mw.msg( 'simplemathJax-visualeditor-inspector-formula-label' )
	} );
	const displayField = new OO.ui.FieldLayout( this.displaySelect, {
		align: 'top',
		label: mw.msg( 'simplemathJax-visualeditor-inspector-display-label' )
	} );

	this.$content.addClass( 've-ui-smjMathInspector-content' );
	this.form.$element.append(
		inputField.$element,
		this.generatedContentsError.$element,
		displayField.$element
	);
};

/**
 * @inheritdoc
 */
ve.ui.SMJMathInspector.prototype.getSetupProcess = function ( data ) {
	return ve.ui.SMJMathInspector.super.prototype.getSetupProcess.call( this, data )
		.next( () => {
			const attrs = this.selectedNode && this.selectedNode.getAttribute( 'mw' ).attrs;
			const display = ( attrs && attrs.display ) || 'default';
			const isReadOnly = this.isReadOnly();

			this.displaySelect.selectItemByData( display ).setDisabled( isReadOnly );

			this.displaySelect.on( 'choose', this.onChangeHandler );
		} );
};

/**
 * @inheritdoc
 */
ve.ui.SMJMathInspector.prototype.getTeardownProcess = function ( data ) {
	return ve.ui.SMJMathInspector.super.prototype.getTeardownProcess.call( this, data )
		.first( () => {
			this.displaySelect.off( 'choose', this.onChangeHandler );
		} );
};

/**
 * @inheritdoc
 */
ve.ui.SMJMathInspector.prototype.updateMwData = function ( mwData ) {
	// Parent method (writes extsrc from this.input)
	ve.ui.SMJMathInspector.super.prototype.updateMwData.call( this, mwData );

	const display = this.displaySelect.findSelectedItem().getData();
	mwData.attrs.display = display !== 'default' ? display : undefined;
};

/**
 * @inheritdoc
 */
ve.ui.SMJMathInspector.prototype.formatGeneratedContentsError = function ( $element ) {
	return $element.text().trim();
};

/* Registration */

ve.ui.windowFactory.register( ve.ui.SMJMathInspector );
