<?php
use MediaWiki\Html\Html;
use MediaWiki\Parser\Sanitizer;
use MediaWiki\Parser\Parser;
use MWDebug;
class SimpleMathJaxHooks {
	private static $useChem;
	private static $wrapDisplaystyle;
	private static $enableHtmlAttributes;
	private static $allowIndent;

	public static function onParserFirstCallInit( Parser $parser ) {
		global $wgOut, $wgSmjUseCdn, $wgSmjUseChem, $wgSmjDirectMathJax, $wgSmjEnableMenu,
			$wgSmjDisplayMath, $wgSmjExtraInlineMath, $wgSmjIgnoreHtmlClass,
			$wgSmjScale, $wgSmjDisplayAlign, $wgSmjWrapDisplaystyle,
			$wgSmjEnableHtmlAttributes, $wgSmjAllowIndent, $wgSmjConfigByRevision;
MWDebug::init();
		$globalvars = [ "wgSmjUseCdn", "wgSmjDirectMathJax",
				"wgSmjDisplayMath", "wgSmjExtraInlineMath", "wgSmjIgnoreHtmlClass",
				"wgSmjScale", "wgSmjEnableMenu", "wgSmjDisplayAlign" ];
		foreach( $globalvars as $varname ) {
			$wgOut->addJsConfigVars( $varname, $$varname );
		}
		self::$useChem = $wgSmjUseChem;
		self::$wrapDisplaystyle = $wgSmjWrapDisplaystyle;
		self::$enableHtmlAttributes = $wgSmjEnableHtmlAttributes;
		self::$allowIndent = $wgSmjAllowIndent;

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
			if (isset($confset["wgSmjAllowIndent"]) ) self::$allowIndent = $confset["wgSmjAllowIndent"];
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
		$last_line_comment = '/(?<!\\\\)(?:\\\\\\\\)*%[^\n]*\z/';
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
		if( !self::$allowIndent ) {
			return;
		}

		MWDebug::log(self::FindTexRanges($text));
	}

	private static function FindTexRanges( string $text ): array {
		global $wgOut;
		$displayMath = $wgOut->getJsConfigVars()["wgSmjDisplayMath"];
		$inlineMath = array_merge($wgOut->getJsConfigVars()["wgSmjExtraInlineMath"], [['[math]', '[/math]']]);
		$delimiters = array_merge($displayMath, $inlineMath);
		$delimiter_map = [];
		foreach ($delimiters as $delim) {
			$delimiter_map[$delim[0]] = $delim[1];
		}

		# Build opening delimiter pattern
		$open_delimiters = implode('|', array_map(function ($delim) { return preg_quote($delim[0], '/'); }, $delimiters));
		if ($wgOut->getJsConfigVars()["wgSmjDirectMathJax"] == "full") {
		} else {
		}
		$start_pattern = "/^ .*$|\\\\begin\{.*?\}|{$open_delimiters}/m";

		$ranges = [];
		$offset = 0;
		$length = strlen($text);

		while ($offset < $length) {
			# Detect leading space or any opening delimiter
			# Whichever appears first takes priority
			$ret = self::preg_match_until($start_pattern, $text, function($matches, $offset) {
				if ($matches[0][0][0] === ' ') {
					return false;
				}
				return true;
			}, $result, $offset);
			if (!$ret) {
				break;
			}
			$match_offset = $result[0][1];

			# Matched one of the opening delimiters
			# Pattern to search for closing delimiter or unescaped braces
			if (preg_match('/^\\\\begin\s\{(.*?)\}$/', $result[0][0], $subresult)) {
				$brace_pattern = '/(\\\\end\s*\{' . preg_quote($subresult[1], '/') . '\}|\\\\[\\\\{}]|[{}])/';
			} else {
				$brace_pattern = '/(' . preg_quote($delimiter_map[$result[0][0]], '/') . '|\\\\[\\\\{}]|[{}])/';
			}

			$offset = $match_offset + strlen($result[0][0]);
			$braces = 0;

			# Search for closing delimiter (considering brace balance)
			$ret = self::preg_match_until($brace_pattern, $text, function($matches, $offset) use (&$braces) {
				if ($matches[0][0] === '{') {
					$braces++;
					return false;
				} else if ($matches[0][0] === '}') {
					if ($braces > 0) {
						$braces--;
					}
					return false;
				} else if (preg_match('/^\\\\[\\\\{}]$/', $matches[0][0])) {
					return false;
				}
				if ($braces > 0) {
					return false;
				}
				return true;
			}, $result, $offset);
			if (!$ret) {//MWDebug::log($brace_pattern);break;
				continue;
			}
			$end_offset = $result[0][1];

			# Matched the closing delimiter
			$offset = $end_offset + strlen($result[0][0]);
			$tex_range = [
				'start' => $match_offset,
				'end' => $offset
			];
			$ranges[] = $tex_range;
			//$offset = $length;
		}

		return $ranges;
	}

	private static function preg_match_until( string $pattern, string $subject, callable $callback,
			?array &$result = null, int $offset = 0 ): bool {
		$flags = PREG_OFFSET_CAPTURE;
		$length = strlen($subject);
		$result = null;

		while ($offset < $length) {
			if (!preg_match($pattern, $subject, $matches, $flags, $offset)) {
				return false;
			}
			$match_offset = $matches[0][1];
			$result = $matches;

			if ($callback($matches, $match_offset)) {
				return true;
			}
			$matched_string = $matches[0][0];
			$offset = $match_offset + strlen($matched_string);
			if (strlen($matched_string) == 0) $offset++;
		}

		return false;
	}
}
