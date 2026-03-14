/*!
 * VisualEditor DataModel SMJMathNode class.
 *
 * @license MIT
 */

/**
 * DataModel MediaWiki math node for SimpleMathJax.
 *
 * Handles <math>...</math> tag extension nodes in the DM layer.
 * Functionally identical to ve.dm.MWMathNode but registered independently
 * so SimpleMathJax does not require Extension:Math.
 *
 * @class
 * @extends ve.dm.MWInlineExtensionNode
 *
 * @constructor
 * @param {Object} [element]
 */
ve.dm.SMJMathNode = function VeDmSMJMathNode() {
	// Parent constructor
	ve.dm.SMJMathNode.super.apply( this, arguments );
};

/* Inheritance */

OO.inheritClass( ve.dm.SMJMathNode, ve.dm.MWInlineExtensionNode );

/* Static members */

ve.dm.SMJMathNode.static.name = 'smjMath';

// ve.dm.SMJMathNode.static.tagName = 'img';
ve.dm.SMJMathNode.static.tagName = 'span';

ve.dm.SMJMathNode.static.extensionName = 'math';

/**
 * @inheritdoc ve.dm.GeneratedContentNode
 *
 * Exclude the id attribute from the rendering hash so that id changes
 * do not trigger unnecessary re-renders.
 */
ve.dm.SMJMathNode.static.getHashObjectForRendering = function ( dataElement ) {
	const hashObject = ve.dm.SMJMathNode.super.static.getHashObjectForRendering.call( this, dataElement );
	if ( hashObject.mw.attrs ) {
		delete hashObject.mw.attrs.id;
	}
	return hashObject;
};

/* Registration */

ve.dm.modelRegistry.register( ve.dm.SMJMathNode );
