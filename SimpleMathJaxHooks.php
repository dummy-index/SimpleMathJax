<?php
use MediaWiki\Html\Html;
use MediaWiki\Parser\Sanitizer;
use MediaWiki\Parser\Parser;
class SimpleMathJaxHooks {
	private static $useChem;
	private static $wrapDisplaystyle;
	private static $enableHtmlAttributes;
	private static $processComments;

	public static function onParserFirstCallInit( Parser $parser ) {
		global $wgOut, $wgSmjUseCdn, $wgSmjUseChem, $wgSmjDirectMathJax, $wgSmjEnableMenu,
			$wgSmjDisplayMath, $wgSmjExtraInlineMath, $wgSmjIgnoreHtmlClass,
			$wgSmjScale, $wgSmjDisplayAlign, $wgSmjWrapDisplaystyle,
			$wgSmjEnableHtmlAttributes, $wgSmjProcessComments, $wgSmjConfigByRevision;

		$globalvars = [ "wgSmjUseCdn", "wgSmjDirectMathJax",
				"wgSmjDisplayMath", "wgSmjExtraInlineMath", "wgSmjIgnoreHtmlClass",
				"wgSmjScale", "wgSmjEnableMenu", "wgSmjDisplayAlign" ];
		foreach( $globalvars as $varname ) {
			$wgOut->addJsConfigVars( $varname, $$varname );
		}
		self::$useChem = $wgSmjUseChem;
		self::$wrapDisplaystyle = $wgSmjWrapDisplaystyle;
		self::$enableHtmlAttributes = $wgSmjEnableHtmlAttributes;
		self::$processComments = $wgSmjProcessComments;

		$articlerev = (int)$wgOut->getRevisionId();
		foreach ($wgSmjConfigByRevision as $confset) {
			if ($articlerev == 0) break;
			if (!isset($confset["upto"]) && !isset($confset["since"])) continue;
			if (isset($confset["upto"]) && $confset["upto"] < $articlerev) continue;
			if (isset($confset["since"]) && $confset["since"] > $articlerev) continue;
			foreach( $globalvars as $varname ) {
				if( isset($confset[$varname]) ) $wgOut->addJsConfigVars( $varname, $confset[$varname] );
			}
			if (isset($confset["wgSmjUseChem"]) ) self::$useChem = $confset["wgSmjUseChem"];
			if (isset($confset["wgSmjWrapDisplaystyle"]) ) self::$wrapDisplaystyle = $confset["wgSmjWrapDisplaystyle"];
			if (isset($confset["wgSmjEnableHtmlAttributes"]) ) self::$enableHtmlAttributes = $confset["wgSmjEnableHtmlAttributes"];
			if (isset($confset["wgSmjProcessComments"]) ) self::$processComments = $confset["wgSmjProcessComments"];
		}

		$wgOut->addModules( [ 'ext.SimpleMathJax' ] );
		$wgOut->addModules( [ 'ext.SimpleMathJax.mobile' ] ); // For MobileFrontend

		$parser->setHook( 'math', __CLASS__ . '::renderMath' );
		if( self::$useChem ) $parser->setHook( 'chem', __CLASS__ . '::renderChem' );
	}

	public static function renderMath($tex, array $args, Parser $parser, PPFrame $frame ) {
		global $wgOut;
		$tex = self::delimitComment( (string)$tex );
		if( !self::$enableHtmlAttributes ) $args = [];
		if( isset($args["chem"]) ) {
			$wgOut->addJsConfigVars( "wgSmjPreloadChem", true );
		}
		if( isset($args["inline-block"]) ) {
			if( isset($args["display"]) ) {
				return self::renderError('SimpleMathJax: Do not use the inline-block attribute and the display attribute together on the same element.');
			}
			$tex = "\\displaystyle{ $tex }";
		} else if( !isset($args["display"]) ) {
			if( self::$wrapDisplaystyle ) $tex = "\\displaystyle{ $tex }";
		} else switch ($args["display"]) {
			case "":
				break;
			case "inline":
				$tex = "\\textstyle{ $tex }";
				break;
			case "block":
				break;
			default:
				return self::renderError('SimpleMathJax: Invalid attribute value: display="' . $args["display"] . '"');
		}
		return self::renderTex($tex, $parser, $args);
	}

	public static function renderChem($tex, array $args, Parser $parser, PPFrame $frame ) {
		global $wgOut;
		$tex = self::delimitComment( (string)$tex );
		$wgOut->addJsConfigVars( "wgSmjPreloadChem", true );
		if( !self::$enableHtmlAttributes ) $args = [];
		return self::renderTex("\\ce{ $tex }", $parser, $args);
	}

	private static function delimitComment($tex ) {
		$last_line_comment = '/(?<!\\\\)(?:\\\\\\\\)*%[^\n]*$/';
		if( preg_match($last_line_comment, $tex) ) {
			return $tex . "\n";
		}
		return $tex;
	}

	private static function renderTex($tex, $parser, $args) {

		$hookContainer = MediaWiki\MediaWikiServices::getInstance()->getHookContainer();
		$attributes = [ "style" => "opacity:.5", "class" => "" ];
		$inherit_tags = [ "class", "id", "title", "lang", "dir" ];
		$validatedAttribs = Sanitizer::validateAttributes( $args, array_fill_keys( $inherit_tags, true ) );
	        $attributes = array_merge( $attributes, $validatedAttribs );

		$hookContainer->run( "SimpleMathJaxAttributes", [ &$attributes, $tex, $args ] );
		if( !isset($attributes["smj-debug"]) && !isset($args["smj-debug"]) ) {
			$attributes["class"] .= " smj-container";
		}

		if( isset($args["display"]) && $args["display"] == "block" ) {
			$element = Html::Element( "span", $attributes, "\\begin{displaymjx}{$tex}\\end{displaymjx}" );
		} else {
			$element = Html::Element( "span", $attributes, "[math]{$tex}[/math]" );
		}
		return [$element, 'markerType'=>'nowiki'];
	}

	private static function renderError($str) {
		$attributes = [ "class" => "error texerror" ];
		$element = Html::Element( "strong", $attributes, $str );
		return [$element, 'markerType'=>'nowiki'];
	}

	public static function onInternalParseBeforeLinks( Parser &$parser, &$text, $stripState ) {
		if( !self::$processComments ) {
			return;
		}
		$markerPattern = Parser::MARKER_PREFIX . '.*?' . Parser::MARKER_SUFFIX;
		$pattern = '/
			(?<!\\\\)(?:\\\\\\\\)*%     # a percent preceded even number of backslashes
			[^\n\x7f]*?                 # everything until \n or marker
			(?:                         # grouping
				(?=\n\s*(?:\n|\x7f|$))  # not eat newline with trailing blank line
				|
				\n                          # eat newline
				|
				(?=' . $markerPattern . '|$)    # make sure its marker or eos
			)
		/x';

		$text = preg_replace($pattern, '', $text);
		$text = str_replace('\\%', '%', $text);
	}
}
