<?php
/**
 * Plugin Name: Scribe Embed Block
 * Description: Adds a Gutenberg block for embedding Scribe guides using validated Scribe URLs.
 * Version: 1.0.0
 * Requires at least: 6.3
 * Requires PHP: 7.4
 * Author: Stephen Schrauger
 * License: GPL-2.0-or-later
 * Text Domain: scribe-embed-block
 */

defined( 'ABSPATH' ) || exit;

/** Register the editor script and dynamic block. */
function scribe_embed_block_register() {
	$asset_version = '1.0.0';

	wp_register_script(
		'scribe-embed-block-editor',
		plugins_url( 'assets/block.js', __FILE__ ),
		array( 'wp-blocks', 'wp-element', 'wp-components', 'wp-block-editor', 'wp-i18n' ),
		$asset_version,
		true
	);

	wp_register_style(
		'scribe-embed-block-editor-style',
		plugins_url( 'assets/editor.css', __FILE__ ),
		array( 'wp-edit-blocks' ),
		$asset_version
	);

	register_block_type(
		'scribe-embed/block',
		array(
			'api_version'     => 3,
			'editor_script'   => 'scribe-embed-block-editor',
			'editor_style'    => 'scribe-embed-block-editor-style',
			'render_callback' => 'scribe_embed_block_render',
			'attributes'      => array(
				'url'              => array(
					'type'    => 'string',
					'default' => '',
				),
				'mode'             => array(
					'type'    => 'string',
					'default' => 'video',
				),
				'width'            => array(
					'type'    => 'string',
					'default' => '100%',
				),
				'height'           => array(
					'type'    => 'number',
					'default' => 800,
				),
				'minHeight'        => array(
					'type'    => 'number',
					'default' => 480,
				),
				'aspectRatio'      => array(
					'type'    => 'string',
					'default' => '16 / 12',
				),
				'allowFullscreen'  => array(
					'type'    => 'boolean',
					'default' => true,
				),
				'lazyLoad'         => array(
					'type'    => 'boolean',
					'default' => true,
				),
				'frameTitle'       => array(
					'type'    => 'string',
					'default' => 'Scribe guide',
				),
			),
			'supports'        => array(
				'html'            => false,
				'align'           => array( 'wide', 'full' ),
				'customClassName' => true,
			),
		)
	);
}
add_action( 'init', 'scribe_embed_block_register' );

/**
 * Turn an accepted Scribe share/viewer/embed URL into the canonical embed URL.
 * Only HTTPS URLs on scribehow.com are accepted, and the path must match a known
 * Scribe link shape. User-supplied query strings are not copied into the iframe.
 *
 * @param string $url URL entered in the block.
 * @param string $mode Embed display mode.
 * @return string|false Canonical embed URL, or false when the URL is invalid.
 */
function scribe_embed_block_get_embed_url( $url, $mode ) {
	$url = trim( (string) $url );
	if ( '' === $url ) {
		return false;
	}

	$parts = wp_parse_url( $url );
	if ( ! is_array( $parts ) || empty( $parts['scheme'] ) || empty( $parts['host'] ) || empty( $parts['path'] ) ) {
		return false;
	}

	if ( 'https' !== strtolower( $parts['scheme'] ) ) {
		return false;
	}

	$host = strtolower( $parts['host'] );
	if ( ! in_array( $host, array( 'scribehow.com', 'www.scribehow.com' ), true ) ) {
		return false;
	}

	// Reject unusual authority components rather than accepting non-canonical URLs.
	if ( isset( $parts['user'] ) || isset( $parts['pass'] ) ) {
		return false;
	}
	if ( isset( $parts['port'] ) && 443 !== (int) $parts['port'] ) {
		return false;
	}

	$path     = trim( $parts['path'], '/' );
	$segments = explode( '/', $path );
	$slug     = '';

	foreach ( $segments as $index => $segment ) {
		$segments[ $index ] = rawurldecode( $segment );
		// Encoded path separators or traversal strings are not accepted.
		if ( false !== strpos( $segments[ $index ], '/' ) || '..' === $segments[ $index ] ) {
			return false;
		}
	}

	if ( 2 === count( $segments ) && in_array( $segments[0], array( 'embed', 'viewer', 'shared' ), true ) ) {
		$slug = $segments[1];
	} elseif ( 4 === count( $segments ) && 'o' === $segments[0] && 'viewer' === $segments[2] ) {
		if ( ! preg_match( '/^[A-Za-z0-9_-]+$/D', $segments[1] ) ) {
			return false;
		}
		$slug = $segments[3];
	} else {
		return false;
	}

	// Scribe's document identifier is embedded in the final URL path segment.
	if ( ! preg_match( '/^[A-Za-z0-9_-]+$/D', $slug ) ) {
		return false;
	}

	$allowed_modes = array( 'slides', 'video', 'scroll' );
	if ( ! in_array( $mode, $allowed_modes, true ) ) {
		$mode = 'video';
	}

	$embed_url = 'https://scribehow.com/embed/' . rawurlencode( $slug );
	return add_query_arg( 'as', $mode, $embed_url );
}

/** Validate a CSS width value against a small allow-list. */
function scribe_embed_block_sanitize_width( $width ) {
	$width = trim( (string) $width );

	if ( preg_match( '/^(?:100|[1-9]?[0-9])%$/D', $width ) ) {
		return $width;
	}

	if ( preg_match( '/^[1-9][0-9]{0,3}px$/D', $width ) ) {
		return $width;
	}

	if ( preg_match( '/^(?:100|[1-9]?[0-9])vw$/D', $width ) ) {
		return $width;
	}

	return '100%';
}

/** Clamp a numeric dimension to a safe range. */
function scribe_embed_block_clamp_dimension( $value, $minimum, $maximum, $default ) {
	if ( ! is_numeric( $value ) ) {
		return $default;
	}

	return (int) max( $minimum, min( $maximum, round( (float) $value ) ) );
}

/** Render the iframe after validating all user-controlled block attributes. */
function scribe_embed_block_render( $attributes ) {
	$url = isset( $attributes['url'] ) ? $attributes['url'] : '';
	$mode = isset( $attributes['mode'] ) ? (string) $attributes['mode'] : 'video';
	$embed_url = scribe_embed_block_get_embed_url( $url, $mode );

	// Do not render an iframe until a valid Scribe URL has been entered.
	if ( false === $embed_url ) {
		return '';
	}

	$width       = scribe_embed_block_sanitize_width( isset( $attributes['width'] ) ? $attributes['width'] : '100%' );
	$height      = scribe_embed_block_clamp_dimension( isset( $attributes['height'] ) ? $attributes['height'] : 800, 200, 2000, 800 );
	$min_height  = scribe_embed_block_clamp_dimension( isset( $attributes['minHeight'] ) ? $attributes['minHeight'] : 480, 0, 1200, 480 );
	$frame_title = isset( $attributes['frameTitle'] ) ? sanitize_text_field( $attributes['frameTitle'] ) : 'Scribe guide';
	$frame_title = '' !== $frame_title ? $frame_title : 'Scribe guide';

	$allowed_aspect_ratios = array( 'none', '16 / 12', '16 / 9', '4 / 3', '1 / 1' );
	$aspect_ratio = isset( $attributes['aspectRatio'] ) ? (string) $attributes['aspectRatio'] : '16 / 12';
	if ( ! in_array( $aspect_ratio, $allowed_aspect_ratios, true ) ) {
		$aspect_ratio = '16 / 12';
	}

	$style = array(
		'width: ' . $width,
		'height: ' . $height . 'px',
		'max-width: 100%',
		'border: 0',
		'display: block',
	);

	if ( 'none' !== $aspect_ratio ) {
		$style[] = 'aspect-ratio: ' . $aspect_ratio;
	}
	if ( $min_height > 0 ) {
		$style[] = 'min-height: ' . $min_height . 'px';
	}

	$loading = ! empty( $attributes['lazyLoad'] ) ? 'lazy' : 'eager';
	$fullscreen = ! empty( $attributes['allowFullscreen'] ) ? ' allow="fullscreen" allowfullscreen' : '';
	$wrapper_attributes = get_block_wrapper_attributes( array( 'class' => 'scribe-embed-block' ) );

	return sprintf(
		'<div %1$s><iframe src="%2$s" title="%3$s" width="%4$s" height="%5$d" loading="%6$s"%7$s style="%8$s"></iframe></div>',
		$wrapper_attributes,
		esc_url( $embed_url ),
		esc_attr( $frame_title ),
		esc_attr( $width ),
		$height,
		esc_attr( $loading ),
		$fullscreen,
		esc_attr( implode( '; ', $style ) . ';' )
	);
}
