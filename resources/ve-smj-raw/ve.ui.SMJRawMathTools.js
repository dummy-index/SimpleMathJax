// ve.ui.SMJRawMathTools.js

// ---- ContextItem（数式をクリックしたとき出るボタン）----

ve.ui.SMJRawMathContextItem = function VeUiSMJRawMathContextItem( surface, config ) {
	ve.ui.SMJRawMathContextItem.super.call( this, surface, config );
};

OO.inheritClass( ve.ui.SMJRawMathContextItem, ve.ui.LinearContextItem );

ve.ui.SMJRawMathContextItem.static.name         = 'smjRawMath';
ve.ui.SMJRawMathContextItem.static.icon         = 'mathematics';
ve.ui.SMJRawMathContextItem.static.label        =
	OO.ui.deferMsg( 'smj-ve-rawmath-context-label' );
ve.ui.SMJRawMathContextItem.static.modelClasses = [ ve.dm.SMJRawMathNode ];
ve.ui.SMJRawMathContextItem.static.commandName  = 'smjRawMath';
ve.ui.SMJRawMathContextItem.static.embeddable   = false;

ve.ui.contextItemFactory.register( ve.ui.SMJRawMathContextItem );

// ---- ToolbarTool（挿入メニュー or ツールバーから新規挿入）----

ve.ui.SMJRawMathTool = function VeUiSMJRawMathTool( toolGroup, config ) {
	ve.ui.SMJRawMathTool.super.call( this, toolGroup, config );
};

OO.inheritClass( ve.ui.SMJRawMathTool, ve.ui.FragmentInspectorTool );

ve.ui.SMJRawMathTool.static.name        = 'smjRawMath';
ve.ui.SMJRawMathTool.static.icon        = 'mathematics';
ve.ui.SMJRawMathTool.static.title       =
	OO.ui.deferMsg( 'smj-ve-rawmath-tool-title' );
ve.ui.SMJRawMathTool.static.modelClasses = [ ve.dm.SMJRawMathNode ];
ve.ui.SMJRawMathTool.static.commandName  = 'smjRawMath';

ve.ui.toolFactory.register( ve.ui.SMJRawMathTool );

// ---- コマンド・シーケンス登録 ----

ve.ui.commandRegistry.register(
	new ve.ui.Command(
		'smjRawMath',        // コマンド名
		'window', 'open',    // action: windowManager.open()
		{ args: [ 'smjRawMath' ], supportedSelections: [ 'linear' ] }
	)
);

ve.ui.sequenceRegistry.register(
	new ve.ui.Sequence(
		'smjRawMath',   // シーケンス名
		'smjRawMath',   // コマンド名
		'$$',           // トリガー文字
		2               // トリガー後に削除する文字数
	)
);
