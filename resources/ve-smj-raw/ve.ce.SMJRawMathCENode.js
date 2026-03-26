// ve.ce.SMJRawMathCENode.js

/**
 * ContentEditable node for SMJRawMath (direct MathJax route).
 *
 * Tag extensionルートの ve.ce.SMJMathNode との差分：
 *   - 継承元が LeafNode + FocusableNode（AlienInlineCENode ではない）
 *   - LaTeX ソースを delimOpen/latex/delimClose 属性から組み立てる
 *   - それ以外のレンダリングロジックは共通化候補
 */
ve.ce.SMJRawMathCENode = function VeCeSMJRawMathCENode( model, config ) {
	ve.ce.SMJRawMathCENode.super.call( this, model, config );

	ve.ce.FocusableNode.call( this );

	this.$element
		.addClass( 've-ce-smjRawMathCENode' )
		// MathJax が typeset する要素を特定できるようにしておく
		.attr( 'data-smj-ce', 'raw' );

	// typesetPromise の実行状態管理
	this._mjRunning = false;
	this._updatePending = false;

	// 初回レンダリング
	this.update();
};

OO.inheritClass( ve.ce.SMJRawMathCENode, ve.ce.LeafNode );
OO.mixinClass(   ve.ce.SMJRawMathCENode, ve.ce.FocusableNode );

ve.ce.SMJRawMathCENode.static.name        = 'smjRawMath';
ve.ce.SMJRawMathCENode.static.primaryCommandName = 'smjRawMath';

// ------------------------------------------------------------
// レンダリング
// ------------------------------------------------------------

/**
 * DM属性からLaTeXソース文字列を組み立てる。
 * Tag extensionルートは mw:ExtensionTag の body.extsrc を使うが、
 * こちらは delimOpen + latex + delimClose の3属性から再構築する。
 *
 * @return {string}
 */
ve.ce.SMJRawMathCENode.prototype.getRawSource = function () {
	var attrs = this.model.getAttributes();
	return ( attrs.delimOpen || '' ) +
	       ( attrs.latex     || ''  ) +
	       ( attrs.delimClose || '' );
};

/**
 * MathJaxでレンダリングする。
 *
 */
ve.ce.SMJRawMathCENode.prototype.update = function () {
	if ( this._mjRunning ) {
		// 実行中 → 完了後に再実行するよう予約するだけ
		this._updatePending = true;
		return;
	}

	if ( !window.MathJax || !MathJax.typesetPromise ) {
		// MathJax 未ロードなら生ソースのまま表示してフォールバック
		this.$element.text( this.getRawSource() );
		return;
	}

	var el        = this.$element[ 0 ];
	var rawSource = this.getRawSource();
	var self      = this;

	// DOM を更新してから typeset
	MathJax.typesetClear( [ el ] );
	// テキストとしてセットしてから MathJax に渡す
	// （前回のレンダリング結果 mjx-container を一旦消す）
	this.$element.empty().text( rawSource );

	this._mjRunning     = true;
	this._updatePending = false;

	MathJax.typesetPromise( [ el ] )
		.then( function () {
			self._mjRunning = false;
			if ( self._updatePending ) {
				// 実行中にリクエストが来ていたので再実行
				self.update();
			}
		} )
		.catch( function ( err ) {
			self._mjRunning = false;
			mw.log.warn( '[SMJRawMath] MathJax typesetPromise failed:', err );
		} );
};

// ------------------------------------------------------------
// ライフサイクル
// ------------------------------------------------------------

/**
 * セットアップ時にDMの属性変更を購読する。
 * Inspector での編集 → changeAttributes → attributeChange イベント
 * → update() でライブプレビューが実現する。
 */
ve.ce.SMJRawMathCENode.prototype.onSetup = function () {
	ve.ce.SMJRawMathCENode.super.prototype.onSetup.call( this );
	this.model.connect( this, { attributeChange: 'onAttributeChange' } );
};

ve.ce.SMJRawMathCENode.prototype.onTeardown = function () {
	this._updatePending = false;
	this.model.disconnect( this );
	ve.ce.SMJRawMathCENode.super.prototype.onTeardown.call( this );
};

ve.ce.SMJRawMathCENode.prototype.onAttributeChange = function () {
	this.update();
};

// ------------------------------------------------------------
// フォーカス時の見た目
// FocusableNode が提供するハイライト枠をそのまま利用する。
// Tag extensionルートと同じ挙動になる。
// ------------------------------------------------------------

ve.ce.nodeFactory.register( ve.ce.SMJRawMathCENode );
