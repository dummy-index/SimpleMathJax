// ve.ui.SMJRawMathInspector.js

ve.ui.SMJRawMathInspector = function VeUiSMJRawMathInspector( config ) {
	ve.ui.SMJRawMathInspector.super.call( this, config );
};

// MWLiveExtensionInspector ではなく NodeInspector を継承する。
// MWLiveExtensionInspector は <tag>...</tag> 形式前提の処理を含むため。
OO.inheritClass( ve.ui.SMJRawMathInspector, ve.ui.NodeInspector );

ve.ui.SMJRawMathInspector.static.name = 'smjRawMathInspector';
ve.ui.SMJRawMathInspector.static.title =
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
			{ data: 'begin-end', label: '(you should keep \\begin{} ... \\end{})' },
			{ data: 'dollar-block', label: '$$…$$ (block)' },
			{ data: 'paren', label: '\\(…\\) (inline)' },
			{ data: 'bracket', label: '\\[…\\] (block)' }
		]
	} );

	// エラー表示ウィジェット
	// 通常は非表示、波括弧不足を検出したら表示する
	this.$errorMessage = $( '<div>' ).addClass(
		've-ui-smjRawMath-errorMessage'
	).hide();

	this.latexInput.connect( this, { change: 'onLatexChange' } );
	this.delimSelect.connect( this, { change: 'onDelimChange' } );

	this.container.$element.append(
		new OO.ui.FieldLayout( this.latexInput, {
			label: mw.msg( 'smj-ve-rawmath-latex-label' ),
			align: 'top'
		} ).$element,
		this.$errorMessage,
		new OO.ui.FieldLayout( this.delimSelect, {
			label: mw.msg( 'smj-ve-rawmath-delim-label' ),
			align: 'top'
		} ).$element
	);
};

// ----------------------------------------------------------------
// 検証とエラー表示（入力変更のたびに呼ぶ）
// ----------------------------------------------------------------

ve.ui.SMJRawMathInspector.prototype._validateAndShowError = function () {
	var latex = this.latexInput.getValue();
	var delim = ve.smj.Delim.fromKey( this.delimSelect.getValue() );
	var result = ve.smj.RawMathValidator.validate( latex, delim );

	if ( result === 'incomplete' ) {
		this.$errorMessage
			.text( mw.msg( 'smj-ve-rawmath-error-braces' ) )
			.show();
	} else {
		this.$errorMessage.hide();
	}

	// Inspector のサイズを再計算
	this.updateSize();

	return result;
};

// ------------------------------------------------------------
// セットアップ・ティアダウン
// ------------------------------------------------------------

ve.ui.SMJRawMathInspector.prototype.getSetupProcess = function ( data ) {
	return ve.ui.SMJRawMathInspector.super.prototype.getSetupProcess
		.call( this, data )
		.next( function () {
			this.getManager().getSurface().getModel().pushStaging();

			var attrs = {};
			if ( this.selectedNode ) {
				attrs = this.selectedNode.getAttributes();
			}

			var delim = ve.smj.Delim.fromAttrs( attrs );

			this.latexInput.setValue(
				ve.smj.RawMathValidator.stripCloserMarker( attrs.latex || '', delim )
			);
			this.delimSelect.setValue( ve.smj.Delim.toKey( delim ) );
		}, this );
};

ve.ui.SMJRawMathInspector.prototype.getActionProcess = function ( action ) {

	if ( action === 'done' ) {
		return new OO.ui.Process( function () {
			var surfaceModel = this.getManager().getSurface().getModel();
			var latex = this.latexInput.getValue();
			var delim = ve.smj.Delim.fromKey( this.delimSelect.getValue() );
			var validation = ve.smj.RawMathValidator.validate( latex, delim );

			if ( validation === 'incomplete' ) {
				var completed = ve.smj.RawMathValidator.complete( latex, delim );

				if ( completed.latex === null ) {
					var msgKey = completed.reason === 'missing-end' ?
						'smj-ve-rawmath-error-missing-end' :
						'smj-ve-rawmath-error-unrecoverable';
					this.$errorMessage.text( mw.msg( msgKey ) ).show();
					this.updateSize();
					return new OO.ui.Error( mw.msg( msgKey ), { recoverable: true } );
				}

				latex = completed.latex;
			}

			var delimAttrs = ve.smj.Delim.toAttrs( delim );

			if ( this.selectedNode ) {
				surfaceModel.getFragment().changeAttributes(
					Object.assign( { latex: latex }, delimAttrs )
				);
			} else {
				surfaceModel.getFragment().insertContent( [
					{
						type: 'smjRawMath',
						attributes: Object.assign( { latex: latex }, delimAttrs )
					},
					{ type: '/smjRawMath' }
				] );
			}

			// Stagingバッファ全体を1トランザクションとしてundoスタックに積む
			surfaceModel.applyStaging();

			this.close( { action: action } );

		}, this );
	}

	if ( action === 'cancel' || action === '' ) {
		return new OO.ui.Process( function () {
			// Stagingバッファを破棄して元の状態に戻す
			this.getManager().getSurface().getModel().popStaging();
			this.close( { action: action } );
		}, this );
	}

	return ve.ui.SMJRawMathInspector.super.prototype
		.getActionProcess.call( this, action );
};

// getTeardownProcess はDMへの書き込みを持たない
// 親のTeardownに完全に委譲（オーバーライド不要）

// ------------------------------------------------------------
// ライブプレビュー：入力 → DM属性を即時更新
// ------------------------------------------------------------

ve.ui.SMJRawMathInspector.prototype.onLatexChange = function () {
	this._validateAndShowError();

	if ( !this.selectedNode ) {
		return;
	}
	this.getManager()
		.getSurface()
		.getModel()
		.getFragment()
		.changeAttributes( { latex: this.latexInput.getValue() } );
};

ve.ui.SMJRawMathInspector.prototype.onDelimChange = function () {
	this._validateAndShowError();

	if ( !this.selectedNode ) {
		return;
	}
	var delimAttrs = ve.smj.Delim.toAttrs(
		ve.smj.Delim.fromKey( this.delimSelect.getValue() )
	);
	this.getManager()
		.getSurface()
		.getModel()
		.getFragment()
		.changeAttributes( delimAttrs );
};

ve.ui.windowFactory.register( ve.ui.SMJRawMathInspector );
