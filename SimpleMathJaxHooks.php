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

	private static $displayMath;
	private static $inlineMath;
	private static $directMathJax;

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

		self::$displayMath = $wgOut->getJsConfigVars()["wgSmjDisplayMath"];
		self::$inlineMath = array_merge($wgOut->getJsConfigVars()["wgSmjExtraInlineMath"], [['[math]', '[/math]']]);
		self::$directMathJax = $wgOut->getJsConfigVars()["wgSmjDirectMathJax"];

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
		static $marker_index = 1;//MWDebug::log($marker_index);

		if( !self::$allowIndent ) {
			return;
		}

		//MWDebug::log(self::findTexRanges($text));
		$block_tag_pattern = '\<\/?(?:p|div|blockquote|center)(?:\s[^>]*)?\>';
		$block_syntax_pattern = '/\n[\s\n]*\n|';  # blank lines
		$block_syntax_pattern .= '[^\n]*\<p(?:\s[^>]*)?\>.*?(?=' . $block_tag_pattern . ')|';
						# The opening p tag groups the text that follows into a p element regardless of indentation
		$block_syntax_pattern .= '[^\n]*' . $block_tag_pattern . '[^\n]*/';
						# Block element tags leave the text on that line separate from the preceding and following paragraphs

		$ret = self::preg_explode($block_syntax_pattern, $text);
		$paragraphs = $ret['tokens'];
		$delimiters = $ret['delimiters'];

		foreach ($paragraphs as &$para) {
			if (trim($para) === '') continue;

			$matches = self::findTexRanges($para);//MWDebug::log($matches);
			$parts = [];
			$prev_end = 0;
			foreach ($matches as $match) {
				$parts[] = substr($para, $prev_end, $match['start'] - $prev_end);
				$marker = Parser::MARKER_PREFIX . '-smjrawtex-' . sprintf( '%08X', $marker_index++ ) . Parser::MARKER_SUFFIX;
				$content = substr($para, $match['start'], $match['end'] - $match['start']);MWDebug::log($content);
				$content = $stripState->unstripGeneral($content);
				$stripState->addNoWiki($marker, $content, 'nowiki');
				$parts[] = $marker;
				$prev_end = $match['end'];
			}
			$parts[] = substr($para, $prev_end);
			$para = implode('', $parts);
		}
		foreach ($delimiters as &$para) {
			if (trim($para) === '') continue;

			$matches = self::findTexRanges($para, false);
			$parts = [];
			$prev_end = 0;
			foreach ($matches as $match) {
				$parts[] = substr($para, $prev_end, $match['start'] - $prev_end);
				$marker = Parser::MARKER_PREFIX . '-smjrawtex-' . sprintf( '%08X', $marker_index++ ) . Parser::MARKER_SUFFIX;
				$content = substr($para, $match['start'], $match['end'] - $match['start']);MWDebug::log($content);
				$content = $stripState->unstripGeneral($content);
				$stripState->addNoWiki($marker, $content, 'nowiki');
				$parts[] = $marker;
				$prev_end = $match['end'];
			}
			$parts[] = substr($para, $prev_end);
			$para = implode('', $parts);
		}

		$text = self::rejoin_with_delimiters($paragraphs, $delimiters);
	}

	private static function preg_explode(string $pattern, string $subject): array {
		preg_match_all($pattern, $subject, $matches, PREG_PATTERN_ORDER);
		$delimiters = $matches[0];

		$tokens = preg_split($pattern, $subject);

		return [ 'tokens' => $tokens, 'delimiters' => $delimiters ];
	}

	private static function rejoin_with_delimiters(array $tokens, array $delimiters): string {
		$parts = [];MWDebug::log($tokens[0]);
		foreach ($tokens as $i => $token) {
			$parts[] = $token;
			if (isset($delimiters[$i])) {
				$parts[] = $delimiters[$i];
				if (strpos($delimiters[$i], 'div')) MWDebug::log($delimiters[$i]);
			}
		}
		return implode('', $parts);
	}

	private static function findTexRanges( string $text, bool $indentIsPre = true ): array {
		$delimiters = array_merge(self::$displayMath, self::$inlineMath);
		$delimiter_map = [];
		foreach ($delimiters as $delim) {
			$delimiter_map[$delim[0]] = $delim[1];
		}

		# Build opening delimiter pattern
		$marker_pattern = Parser::MARKER_PREFIX . '.*?' . Parser::MARKER_SUFFIX;
		$open_delimiters = implode('|', array_map(function ($delim) { return preg_quote($delim[0], '/'); }, $delimiters));
		$start_pattern = '/';
		if ($indentIsPre) {
			$start_pattern .= '^ .*$|';
		}
		if (self::$directMathJax == "full") {
			# processEscapes = true
			$start_pattern .= '\\\\[\\\\$]|';
		}
		$start_pattern .= $marker_pattern . '|\\\\begin\s*\{.*?\}|' . $open_delimiters . '/m';

		$ranges = [];
		$offset = 0;
		$length = strlen($text);

		while ($offset < $length) {
			# Detect leading space or any opening delimiter
			# Whichever appears first takes priority
			$ret = self::preg_match_until($start_pattern, $text, function($matches, $offset) {
				if ($matches[0][0][0] === ' ') {
					return false;
				} else if ($matches[0][0][0] === "\x7f") {
					return false;
				} else if ($matches[0][0] === '\\\\' || $matches[0][0] === '\\$') {
					return false;
				}
				return true;  # success
			}, $result, $offset);
			if (!$ret) {
				break;
			}
			$match_offset = $result[0][1];

			# Matched one of the opening delimiters
			# Pattern to search for closing delimiter or unescaped braces
			if (preg_match('/^\\\\begin\s*\{(.*?)\}$/', $result[0][0], $subresult)) {
				$brace_pattern = '/(\\\\end\s*\{' . preg_quote($subresult[1], '/') . '\}|';
			} else {
				$brace_pattern = '/(' . preg_quote($delimiter_map[$result[0][0]], '/') . '|';
			}
			$brace_pattern .= $marker_pattern . '\<(\/?[-\w]+)[^>]*\>|\\\\[\\\\{}]|[{}])/';

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
				} else if ($matches[0][0][0] === '<') {
					if (strpos($matches[0][0], 'span')) MWDebug::log($matches[0][0]);
					if ($matches[1][0] === 'br' || $matches[1][0] === 'wbr') {
						return false;
					}  # Not supported: Inconsistent closing span tags that will eventually be removed but still exist at this point
					return true;  # decline
				} else if ($matches[0][0][0] === "\x7f") {
					return false;
				}
				if ($braces > 0) {
					return false;
				}
				return true;  # success
			}, $result, $offset);
			if (!$ret) {
				continue;
			} else if ($result[0][0][0] === '<') {
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
