/*!
 * VisualEditor UserInterface SMJMathContextItem and SMJMathDialogTool classes.
 *
 * @license MIT
 */

// ---------------------------------------------------------------------------
// ContextItem: appears in the inline context toolbar when a math node
// is selected. Shows a "Quick edit" button that opens the inspector.
// ---------------------------------------------------------------------------

/**
 * Context item for a SimpleMathJax math node.
 *
 * @class
 * @extends ve.ui.LinearContextItem
 *
 * @param {ve.ui.LinearContext} context
 * @param {ve.dm.Model} model
 * @param {Object} [config]
 */
ve.ui.SMJMathContextItem = function VeUiSMJMathContextItem() {
	// Parent constructor
	ve.ui.SMJMathContextItem.super.apply( this, arguments );

	//

	this.$element.addClass( 've-ui-smjMathContextItem' );
};

/* Inheritance */

OO.inheritClass( ve.ui.SMJMathContextItem, ve.ui.LinearContextItem );

/* Static Properties */

ve.ui.SMJMathContextItem.static.name = 'smjMath';

ve.ui.SMJMathContextItem.static.icon = 'mathematics';

ve.ui.SMJMathContextItem.static.label = OO.ui.deferMsg( 'simplemathJax-visualeditor-inspector-title' );

ve.ui.SMJMathContextItem.static.modelClasses = [ ve.dm.SMJMathNode ];

ve.ui.SMJMathContextItem.static.embeddable = false;

// Primary command (desktop): opens the inspector directly
ve.ui.SMJMathContextItem.static.commandName = 'smjMathInspector';

// Inline edit command (mobile primary / desktop quick-edit button)
ve.ui.SMJMathContextItem.static.inlineEditCommand = 'smjMathInspector';

/* Methods */

/**
 * @inheritdoc
 */
ve.ui.SMJMathContextItem.prototype.getCommand = function () {
	return this.context.getSurface().commandRegistry.lookup(
		this.constructor.static.commandName
	);
};

/**
 * @inheritdoc
 */
ve.ui.SMJMathContextItem.prototype.getDescription = function () {
	return ve.ce.nodeFactory.getDescription( this.model );
};

/* Registration */

ve.ui.contextItemFactory.register( ve.ui.SMJMathContextItem );

// ---------------------------------------------------------------------------
// DialogTool: toolbar button that inserts a new math node or opens the
// inspector when an existing math node is selected.
// ---------------------------------------------------------------------------

/**
 * Toolbar tool for inserting/editing SimpleMathJax math nodes.
 *
 * @class
 * @extends ve.ui.FragmentWindowTool
 *
 * @constructor
 * @param {OO.ui.ToolGroup} toolGroup
 * @param {Object} [config]
 */
ve.ui.SMJMathDialogTool = function VeUiSMJMathDialogTool( toolGroup, config ) {
	ve.ui.SMJMathDialogTool.super.call( this, toolGroup, config );
};

OO.inheritClass( ve.ui.SMJMathDialogTool, ve.ui.FragmentWindowTool );

ve.ui.SMJMathDialogTool.static.name = 'smjMath';
ve.ui.SMJMathDialogTool.static.group = 'object';
ve.ui.SMJMathDialogTool.static.icon = 'mathematics';
ve.ui.SMJMathDialogTool.static.title = OO.ui.deferMsg( 'simplemathJax-visualeditor-inspector-title' );
ve.ui.SMJMathDialogTool.static.modelClasses = [ ve.dm.SMJMathNode ];
ve.ui.SMJMathDialogTool.static.commandName = 'smjMathInspector';

ve.ui.toolFactory.register( ve.ui.SMJMathDialogTool );

// ---------------------------------------------------------------------------
// Command and sequence registration
// ---------------------------------------------------------------------------

ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'smjMathInspector', 'window', 'open',
		{ args: [ 'smjMathInspector' ], supportedSelections: [ 'linear' ] }
	)
);

// Typing "<math" auto-opens the inspector (same pattern as Extension:Math)
ve.ui.sequenceRegistry.register(
	new ve.ui.Sequence( 'wikitextSmjMath', 'smjMathInspector', '<math', 5 )
);

ve.ui.commandHelpRegistry.register( 'insert', 'smjMathInspector', {
	sequences: [ 'wikitextSmjMath' ],
	label: OO.ui.deferMsg( 'simplemathJax-visualeditor-inspector-title' )
} );
