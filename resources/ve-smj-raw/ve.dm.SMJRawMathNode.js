// ve.dm.SMJRawMathNode.js
ve.dm.SMJRawMathNode = function VeDmSMJRawMathNode() {
    ve.dm.SMJRawMathNode.super.apply( this, arguments );
};

OO.inheritClass( ve.dm.SMJRawMathNode, ve.dm.LeafNode );
OO.mixinClass(   ve.dm.SMJRawMathNode, ve.dm.FocusableNode );

ve.dm.SMJRawMathNode.static.name            = 'smjRawMath';
ve.dm.SMJRawMathNode.static.isContent       = true;  // インラインノード
ve.dm.SMJRawMathNode.static.matchTagNames   = [ 'span' ];

ve.dm.SMJRawMathNode.static.matchFunction = function ( domElement ) {
    return domElement.getAttribute( 'typeof' ) === 'mw:SMJRawMath';
};

ve.dm.SMJRawMathNode.static.toDataElement = function ( domElements ) {
    var el = domElements[ 0 ];	
    return {
        type: 'smjRawMath',
        attributes: {
            latex:      el.getAttribute( 'data-smj-latex' )      || '',
            delimOpen:  el.getAttribute( 'data-smj-delim-open' ) || '',
            delimClose: el.getAttribute( 'data-smj-delim-close' ) || ''
        }
    };
};

ve.dm.SMJRawMathNode.static.toDomElements = function ( dataElement, doc, converter ) {
    var latex      = dataElement.attributes.latex;
    var delimOpen  = dataElement.attributes.delimOpen;
    var delimClose = dataElement.attributes.delimClose;
    var raw        = delimOpen + latex + delimClose;

    if ( converter.isForParser() ) {
        // 保存時：生テキストとしてParsoidに渡す
        return [ doc.createTextNode( raw ) ];
    }

    // CLIPBOARD / PREVIEW：spanで情報を保持
    var span = doc.createElement( 'span' );
    span.setAttribute( 'typeof',              'mw:SMJRawMath' );
    span.setAttribute( 'data-smj-latex',       latex );
    span.setAttribute( 'data-smj-delim-open',  delimOpen );
    span.setAttribute( 'data-smj-delim-close', delimClose );
    span.textContent = raw;
    return [ span ];
};

ve.dm.modelRegistry.register( ve.dm.SMJRawMathNode );
