// ve.ui.SMJRawMathInspector.js

ve.ui.SMJRawMathInspector = function VeUiSMJRawMathInspector( config ) {
	ve.ui.SMJRawMathInspector.super.call( this, config );
};

// MWExtensionInspector ではなく NodeInspector を継承する。
// MWExtensionInspector は <tag>...</tag> 形式前提の処理を含むため。
OO.inheritClass( ve.ui.SMJRawMathInspector, ve.ui.NodeInspector );

ve.ui.SMJRawMathInspector.static.name    = 'smjRawMath';
ve.ui.SMJRawMathInspector.static.title   =
	OO.ui.deferMsg( 'smj-ve-rawmath-inspector-title' );
ve.ui.SMJRawMathInspector.static.modelClasses = [ ve.dm.SMJRawMathNode ];

// ------------------------------------------------------------
// UI構築
// ------------------------------------------------------------

ve.ui.SMJRawMathInspector.prototype.initialize = function () {
    ve.ui.SMJRawMathInspector.super.prototype.initialize.call( this );

    this.latexInput = new OO.ui.MultilineTextInputWidget( {
        autosize: true,
        rows: 3,
        classes: [ 've-ui-smjRawMath-latexInput' ]
    } );

    this.delimSelect = new OO.ui.DropdownInputWidget( {
        options: [
            { data: 'dollar-inline', label: '$…$　（インライン）'    },
            { data: 'dollar-block',  label: '$$…$$　（ブロック）'    },
            { data: 'paren',         label: '\\(…\\)　（インライン）' },
            { data: 'bracket',       label: '\\[…\\]　（ブロック）'   }
        ]
    } );

    this.latexInput.connect( this, { change: 'onLatexChange' } );
    this.delimSelect.connect( this, { change: 'onDelimChange' } );

    // $body ではなく this.container.$element に追加する
    this.container.$element.append(
        new OO.ui.FieldLayout( this.latexInput, {
            label: mw.msg( 'smj-ve-rawmath-latex-label' ),
            align: 'top'
        } ).$element,
        new OO.ui.FieldLayout( this.delimSelect, {
            label: mw.msg( 'smj-ve-rawmath-delim-label' ),
            align: 'top'
        } ).$element
    );
};

// ------------------------------------------------------------
// デリミタペア ↔ ドロップダウン値の変換
// ------------------------------------------------------------

/**
 * delimOpen/delimClose のペアからドロップダウン値を返す。
 *
 * @param {string} open
 * @param {string} close
 * @return {string}
 */
ve.ui.SMJRawMathInspector.prototype.delimPairToKey = function ( open, close ) {
	if ( open === '$$'  && close === '$$'  ) return 'dollar-block';
	if ( open === '\\(' && close === '\\)' ) return 'paren';
	if ( open === '\\[' && close === '\\]' ) return 'bracket';
	return 'dollar-inline'; // デフォルト: $...$
};

/**
 * ドロップダウン値から delimOpen/delimClose ペアを返す。
 *
 * @param {string} key
 * @return {{ delimOpen: string, delimClose: string }}
 */
ve.ui.SMJRawMathInspector.prototype.delimKeyToPair = function ( key ) {
	switch ( key ) {
		case 'dollar-block': return { delimOpen: '$$',   delimClose: '$$'   };
		case 'paren':        return { delimOpen: '\\(',  delimClose: '\\)'  };
		case 'bracket':      return { delimOpen: '\\[',  delimClose: '\\]'  };
		default:             return { delimOpen: '$',    delimClose: '$'    };
	}
};

// ------------------------------------------------------------
// セットアップ・ティアダウン
// ------------------------------------------------------------

ve.ui.SMJRawMathInspector.prototype.getSetupProcess = function ( data ) {
	return ve.ui.SMJRawMathInspector.super.prototype.getSetupProcess
		.call( this, data )
		.next( function () {
			var attrs = {};
			if ( this.selectedNode ) {
				attrs = this.selectedNode.getAttributes();
			}

			this.latexInput.setValue( attrs.latex || '' );
			this.delimSelect.setValue(
				this.delimPairToKey(
					attrs.delimOpen  || '$',
					attrs.delimClose || '$'
				)
			);
		}, this );
};

ve.ui.SMJRawMathInspector.prototype.getTeardownProcess = function ( data ) {
	return ve.ui.SMJRawMathInspector.super.prototype.getTeardownProcess
		.call( this, data )
		.first( function () {
			if ( !data || data.action !== 'done' ) {
				return;
			}

			var latex = this.latexInput.getValue();
			var pair = this.delimKeyToPair( this.delimSelect.getValue() );

			if ( this.selectedNode ) {
				// 既存ノードの属性を更新
				this.getManager()
					.getSurface()
					.getModel()
					.getFragment()
					.changeAttributes( {
						latex:      latex,
						delimOpen:  pair.delimOpen,
						delimClose: pair.delimClose
					} );
			} else {
				// 新規挿入：DMデータを作ってカーソル位置に挿入
				this.getManager()
				.getSurface()
				.getModel()
				.getFragment()
				.insertContent( [
					{
						type: 'smjRawMath',
						attributes: {
							latex:      latex,
							delimOpen:  pair.delimOpen,
							delimClose: pair.delimClose
						}
					},
					{ type: '/smjRawMath' }
				] );
			}
		}, this );
};

// ------------------------------------------------------------
// ライブプレビュー：入力 → DM属性を即時更新
// ------------------------------------------------------------

ve.ui.SMJRawMathInspector.prototype.onLatexChange = function () {
	if ( !this.selectedNode ) return;
	this.getManager()
		.getSurface()
		.getModel()
		.getFragment()
		.changeAttributes( { latex: this.latexInput.getValue() } );
};

ve.ui.SMJRawMathInspector.prototype.onDelimChange = function () {
	if ( !this.selectedNode ) return;
	var pair = this.delimKeyToPair( this.delimSelect.getValue() );
	this.getManager()
		.getSurface()
		.getModel()
		.getFragment()
		.changeAttributes( pair );
};

ve.ui.windowFactory.register( ve.ui.SMJRawMathInspector );
