<?php
/**
 * Plugin Name: Scribe Embed Block
 * Description: Adds a Gutenberg block for embedding Scribe guides using validated Scribe URLs.
 * Version: 1.2.0
 * Requires at least: 6.3
 * Requires PHP: 7.4
 * Author: Stephen Schrauger
 * Plugin URI: https://github.com/HashBangCrash/scribe-embed-block
 * License: GPL-2.0-or-later
 * Text Domain: scribe-embed-block
 */

namespace hbc_scribe_embed_block;

defined('ABSPATH') || exit;

/**
 * Register the editor script and dynamic block.
 */
function scribe_embed_block_register()
{
    $asset_version = '1.1.0';

    wp_register_script(
        'scribe-embed-block-editor',
        plugins_url('assets/block.js', __FILE__),
        array(
            'wp-blocks',
            'wp-element',
            'wp-components',
            'wp-block-editor',
            'wp-i18n',
        ),
        $asset_version,
        true
    );

    wp_register_style(
        'scribe-embed-block-editor-style',
        plugins_url('assets/editor.css', __FILE__),
        array('wp-edit-blocks'),
        $asset_version
    );

    register_block_type(
        'scribe-embed/block',
        array(
            'api_version' => 3,
            'editor_script' => 'scribe-embed-block-editor',
            'editor_style' => 'scribe-embed-block-editor-style',
            'render_callback' => __NAMESPACE__ . '\\scribe_embed_block_render',

            'attributes' => array(
                'url' => array(
                    'type' => 'string',
                    'default' => '',
                ),
                'mode' => array(
                    'type' => 'string',
                    'default' => 'video',
                ),
                'width' => array(
                    'type' => 'string',
                    'default' => '100%',
                ),
                'height' => array(
                    'type' => 'number',
                    'default' => 800,
                ),
                'responsive' => array(
                    'type' => 'boolean',
                    'default' => true,
                ),
                'minHeight' => array(
                    'type' => 'number',
                    'default' => 0,
                ),
                'aspectRatio' => array(
                    'type' => 'string',
                    'default' => '16 / 12',
                ),
                'prohibitFullscreen' => array(
                    'type' => 'boolean',
                    'default' => false,
                ),
                'lazyLoad' => array(
                    'type' => 'boolean',
                    'default' => true,
                ),
                'skipIntro' => array(
                    'type' => 'boolean',
                    'default' => false,
                ),
                'removeLogo' => array(
                    'type' => 'boolean',
                    'default' => false,
                ),
                'frameTitle' => array(
                    'type' => 'string',
                    'default' => 'Scribe guide',
                ),
            ),

            'supports' => array(
                'html' => false,
                'align' => array('wide', 'full'),
                'customClassName' => true,
            ),
        )
    );
}

add_action(
    'init',
    __NAMESPACE__ . '\\scribe_embed_block_register'
);
/**
 * Convert an accepted Scribe URL into a canonical embed URL.
 *
 * Only HTTPS URLs on scribehow.com are accepted.
 * The path must match a recognized Scribe URL format.
 * User-supplied query parameters are not copied into the iframe.
 *
 * @param string $url URL entered in the block.
 * @param string $mode Embed display mode.
 * @return string|false Canonical embed URL, or false if invalid.
 */
function scribe_embed_block_get_embed_url($url, $mode)
{
    $url = trim((string)$url);

    if ('' === $url) {
        return false;
    }

    $parts = wp_parse_url($url);

    if (
        !is_array($parts)
        || empty($parts['scheme'])
        || empty($parts['host'])
        || empty($parts['path'])
    ) {
        return false;
    }

    if ('https' !== strtolower($parts['scheme'])) {
        return false;
    }

    $host = strtolower($parts['host']);

    if (
        !in_array(
            $host,
            array('scribehow.com', 'www.scribehow.com'),
            true
        )
    ) {
        return false;
    }

    // Reject unusual authority components.
    if (isset($parts['user']) || isset($parts['pass'])) {
        return false;
    }

    if (isset($parts['port']) && 443 !== (int)$parts['port']) {
        return false;
    }

    $path = trim($parts['path'], '/');
    $segments = explode('/', $path);
    $slug = '';

    foreach ($segments as $index => $segment) {
        $segments[$index] = rawurldecode($segment);

        // Reject encoded path separators and traversal strings.
        if (
            false !== strpos($segments[$index], '/')
            || '..' === $segments[$index]
        ) {
            return false;
        }
    }

    // URLs such as /embed/SLUG, /viewer/SLUG, or /shared/SLUG.
    if (
        2 === count($segments)
        && in_array(
            $segments[0],
            array('embed', 'viewer', 'shared'),
            true
        )
    ) {
        $slug = $segments[1];

        // URLs such as /o/SHARE_ID/viewer/SLUG.
    } elseif (
        4 === count($segments)
        && 'o' === $segments[0]
        && 'viewer' === $segments[2]
    ) {
        if (!preg_match('/^[A-Za-z0-9_-]+$/D', $segments[1])) {
            return false;
        }

        $slug = $segments[3];

    } else {
        return false;
    }

    // Validate the final path segment.
    if (!preg_match('/^[A-Za-z0-9_-]+$/D', $slug)) {
        return false;
    }

    $allowed_modes = array('slides', 'video', 'scroll');

    if (!in_array($mode, $allowed_modes, true)) {
        $mode = 'video';
    }

    $embed_url = 'https://scribehow.com/embed/' . rawurlencode($slug);

    return add_query_arg('as', $mode, $embed_url);
}

/**
 * Sanitize a CSS width value.
 *
 * Accepts percentages, pixels, or viewport-width units.
 *
 * @param string $width Requested width.
 * @return string Sanitized width.
 */
function scribe_embed_block_sanitize_width($width)
{
    $width = trim((string)$width);

    if (preg_match('/^(?:100|[1-9]?[0-9])%$/D', $width)) {
        return $width;
    }

    if (preg_match('/^[1-9][0-9]{0,3}px$/D', $width)) {
        return $width;
    }

    if (preg_match('/^(?:100|[1-9]?[0-9])vw$/D', $width)) {
        return $width;
    }

    return '100%';
}

/**
 * Clamp a numeric dimension to a safe range.
 *
 * @param mixed $value Requested value.
 * @param int $minimum Minimum allowed value.
 * @param int $maximum Maximum allowed value.
 * @param int $default Default value.
 * @return int Sanitized value.
 */
function scribe_embed_block_clamp_dimension(
    $value,
    $minimum,
    $maximum,
    $default
)
{
    if (!is_numeric($value)) {
        return $default;
    }

    return (int)max(
        $minimum,
        min($maximum, round((float)$value))
    );
}

/**
 * Render the iframe after validating block attributes.
 *
 * @param array $attributes Block attributes.
 * @return string Rendered HTML.
 */
function scribe_embed_block_render($attributes)
{
    $url = isset($attributes['url'])
        ? $attributes['url']
        : '';

    $mode = isset($attributes['mode'])
        ? (string)$attributes['mode']
        : 'video';

    $embed_url = scribe_embed_block_get_embed_url($url, $mode);

    // Do not render an iframe for an invalid URL.
    if (false === $embed_url) {
        return '';
    }

    $responsive = !isset($attributes['responsive'])
        || !empty($attributes['responsive']);

    $width = $responsive
        ? '100%'
        : scribe_embed_block_sanitize_width(
            isset($attributes['width'])
                ? $attributes['width']
                : '100%'
        );

    $height = scribe_embed_block_clamp_dimension(
        isset($attributes['height'])
            ? $attributes['height']
            : 800,
        200,
        2000,
        800
    );

    $min_height = scribe_embed_block_clamp_dimension(
        isset($attributes['minHeight'])
            ? $attributes['minHeight']
            : 0,
        0,
        1200,
        0
    );

    $frame_title = isset($attributes['frameTitle'])
        ? sanitize_text_field($attributes['frameTitle'])
        : 'Scribe guide';

    if ('' === $frame_title) {
        $frame_title = 'Scribe guide';
    }

    $allowed_aspect_ratios = array(
        'none',
        '16 / 12',
        '16 / 9',
        '4 / 3',
        '1 / 1',
    );

    $aspect_ratio = isset($attributes['aspectRatio'])
        ? (string)$attributes['aspectRatio']
        : '16 / 12';

    if (!in_array($aspect_ratio, $allowed_aspect_ratios, true)) {
        $aspect_ratio = '16 / 12';
    }

    // Construct the query parameters ourselves.
    $query_args = array(
        'as' => in_array(
            $mode,
            array('slides', 'video', 'scroll'),
            true
        ) ? $mode : 'video',
    );

    if (!empty($attributes['skipIntro'])) {
        $query_args['skipIntro'] = 'true';
    }

    if (!empty($attributes['removeLogo'])) {
        $query_args['removeLogo'] = 'true';
    }

    $embed_url = add_query_arg($query_args, $embed_url);

    $wrapper_style = array(
        'width: ' . $width,
        'max-width: 100%',
    );

    $iframe_style = array(
        'width: 100%',
        'border: 0',
        'display: block',
    );

    if ($responsive && 'none' !== $aspect_ratio) {
        /*
         * A cross-origin iframe cannot expose its content height to the
         * parent page. Use a responsive aspect ratio instead.
         */
        $wrapper_style[] = 'position: relative';
        $wrapper_style[] = 'aspect-ratio: ' . $aspect_ratio;

        if ($min_height > 0) {
            $wrapper_style[] = 'min-height: ' . $min_height . 'px';
        }

        $iframe_style[] = 'position: absolute';
        $iframe_style[] = 'top: 0';
        $iframe_style[] = 'left: 0';
        $iframe_style[] = 'height: 100%';

    } else {
        $iframe_style[] = 'height: ' . $height . 'px';

        if ($min_height > 0) {
            $iframe_style[] = 'min-height: ' . $min_height . 'px';
        }

        if (!$responsive && 'none' !== $aspect_ratio) {
            $iframe_style[] = 'aspect-ratio: ' . $aspect_ratio;
        }
    }

    $loading = !empty($attributes['lazyLoad'])
        ? 'lazy'
        : 'eager';

    $fullscreen = !empty($attributes['prohibitFullscreen'])
        ? ''
        : ' allow="fullscreen" allowFullscreen';

    $wrapper_attributes = get_block_wrapper_attributes(
        array(
            'class' => 'scribe-embed-block',
            'style' => implode('; ', $wrapper_style) . ';',
        )
    );

    return sprintf(
        '<div %1$s><iframe src="%2$s" title="%3$s" width="%4$s" height="%5$d" loading="%6$s"%7$s style="%8$s"></iframe></div>',
        $wrapper_attributes,
        esc_url($embed_url),
        esc_attr($frame_title),
        esc_attr($width),
        $height,
        esc_attr($loading),
        $fullscreen,
        esc_attr(implode('; ', $iframe_style) . ';')
    );
}