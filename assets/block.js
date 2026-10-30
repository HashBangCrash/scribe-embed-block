(function (wp) {
	'use strict';

	var el = wp.element.createElement;
	var Fragment = wp.element.Fragment;
	var registerBlockType = wp.blocks.registerBlockType;
	var __ = wp.i18n.__;

	var InspectorControls = wp.blockEditor.InspectorControls;
	var InspectorAdvancedControls = wp.blockEditor.InspectorAdvancedControls;
	var useBlockProps = wp.blockEditor.useBlockProps;

	var PanelBody = wp.components.PanelBody;
	var TextControl = wp.components.TextControl;
	var SelectControl = wp.components.SelectControl;
	var RangeControl = wp.components.RangeControl;
	var ToggleControl = wp.components.ToggleControl;
	var Notice = wp.components.Notice;
	var Button = wp.components.Button;

	/**
	 * Validate Scribe URLs before accepting them in the editor.
	 *
	 * The PHP renderer performs its own validation, so this is an
	 * editor convenience rather than the security boundary.
	 *
	 * @param {string} value URL entered by the editor.
	 * @return {boolean} Whether the URL is supported.
	 */
	function isValidScribeUrl(value) {
		if (!value) {
			return false;
		}

		try {
			var parsed = new URL(value.trim());

			if (
				parsed.protocol !== 'https:' ||
				!['scribehow.com', 'www.scribehow.com'].includes(
					parsed.hostname.toLowerCase()
				) ||
				parsed.port ||
				parsed.username ||
				parsed.password
			) {
				return false;
			}

			var segments = parsed.pathname
				.split('/')
				.filter(Boolean)
				.map(function (segment) {
					return decodeURIComponent(segment);
				});

			if (
				segments.some(function (segment) {
					return segment.indexOf('/') !== -1 ||
						segment === '..';
				})
			) {
				return false;
			}

			var slug = '';

			if (
				segments.length === 2 &&
				['embed', 'viewer', 'shared'].includes(segments[0])
			) {
				slug = segments[1];
			} else if (
				segments.length === 4 &&
				segments[0] === 'o' &&
				segments[2] === 'viewer' &&
				/^[A-Za-z0-9_-]+$/.test(segments[1])
			) {
				slug = segments[3];
			} else {
				return false;
			}

			return /^[A-Za-z0-9_-]+$/.test(slug);
		} catch (error) {
			return false;
		}
	}

	/**
	 * Convert a supported Scribe URL to its canonical embed URL.
	 *
	 * Display mode and optional query parameters are generated from
	 * block attributes instead of trusting parameters in the input URL.
	 *
	 * @param {string} value Scribe viewer, share, or embed URL.
	 * @param {Object} attributes Block attributes.
	 * @return {string} Canonical embed URL, or an empty string.
	 */
	function getEmbedUrl(value, attributes) {
		if (!isValidScribeUrl(value)) {
			return '';
		}

		try {
			var parsed = new URL(value.trim());

			var segments = parsed.pathname
				.split('/')
				.filter(Boolean)
				.map(function (segment) {
					return decodeURIComponent(segment);
				});

			var slug = segments[segments.length - 1];

			var embedUrl = new URL(
				'https://scribehow.com/embed/' + slug
			);

			embedUrl.searchParams.set(
				'as',
				['video', 'slides', 'scroll'].includes(attributes.mode)
					? attributes.mode
					: 'video'
			);

			if (attributes.skipIntro) {
				embedUrl.searchParams.set('skipIntro', 'true');
			}

			if (attributes.removeLogo) {
				embedUrl.searchParams.set('removeLogo', 'true');
			}

			return embedUrl.toString();
		} catch (error) {
			return '';
		}
	}

	/**
	 * Build iframe sizing styles for the editor preview.
	 *
	 * These settings mirror the intended frontend sizing behavior.
	 *
	 * @param {Object} attributes Block attributes.
	 * @return {Object} Inline iframe styles.
	 */
	function getPreviewStyles(attributes) {
		var responsive = attributes.responsive !== false;
		var width = attributes.width || '100%';
		var height = attributes.height || 800;
		var minHeight = attributes.minHeight || 0;
		var aspectRatio = attributes.aspectRatio || '16 / 12';

		var styles = {
			display: 'block',
			border: 0,
			maxWidth: '100%'
		};

		if (responsive) {
			styles.width = '100%';

			if (aspectRatio !== 'none') {
				styles.height = 'auto';
				styles.aspectRatio = aspectRatio;
			} else {
				styles.height = height + 'px';
			}
		} else {
			styles.width = width;
			styles.height = height + 'px';
		}

		if (minHeight > 0) {
			styles.minHeight = minHeight + 'px';
		}

		return styles;
	}

	registerBlockType('scribe-embed/block', {
		apiVersion: 3,

		title: __('Scribe Embed', 'scribe-embed-block'),

		description: __(
			'Embed a Scribe guide without using a Custom HTML block.',
			'scribe-embed-block'
		),

		icon: 'format-video',
		category: 'embed',

		keywords: [
			__('Scribe', 'scribe-embed-block'),
			__('guide', 'scribe-embed-block'),
			__('tutorial', 'scribe-embed-block')
		],

		attributes: {
			url: {
				type: 'string',
				default: ''
			},
			mode: {
				type: 'string',
				default: 'video'
			},
			width: {
				type: 'string',
				default: '100%'
			},
			height: {
				type: 'number',
				default: 800
			},
			responsive: {
				type: 'boolean',
				default: true
			},
			minHeight: {
				type: 'number',
				default: 0
			},
			aspectRatio: {
				type: 'string',
				default: '16 / 12'
			},
			prohibitFullscreen: {
				type: 'boolean',
				default: false
			},
			lazyLoad: {
				type: 'boolean',
				default: true
			},
			skipIntro: {
				type: 'boolean',
				default: false
			},
			removeLogo: {
				type: 'boolean',
				default: false
			},
			frameTitle: {
				type: 'string',
				default: 'Scribe guide'
			}
		},

		supports: {
			html: false,
			align: ['wide', 'full'],
			customClassName: true
		},

		edit: function (props) {
			var attributes = props.attributes;
			var setAttributes = props.setAttributes;

			var responsive = attributes.responsive !== false;
			var validUrl = isValidScribeUrl(attributes.url);
			var embedUrl = getEmbedUrl(attributes.url, attributes);

			var blockProps = useBlockProps({
				className: 'scribe-embed-editor'
			});

			/**
			 * Update a single block attribute.
			 *
			 * @param {string} name Attribute name.
			 * @param {*} value New value.
			 */
			function updateAttribute(name, value) {
				var update = {};
				update[name] = value;
				setAttributes(update);
			}

			/**
			 * Render the block settings controls.
			 *
			 * @return {Array} Settings controls.
			 */
			function renderSettings() {
				return [
					el(SelectControl, {
						key: 'mode',
						label: __('Display mode', 'scribe-embed-block'),
						value: attributes.mode,
						options: [
							{
								label: __('Video', 'scribe-embed-block'),
								value: 'video'
							},
							{
								label: __('Slides', 'scribe-embed-block'),
								value: 'slides'
							},
							{
								label: __('Scroll', 'scribe-embed-block'),
								value: 'scroll'
							}
						],
						onChange: function (value) {
							updateAttribute('mode', value);
						}
					}),

					el(ToggleControl, {
						key: 'responsive',
						label: __('Responsive sizing', 'scribe-embed-block'),
						help: __(
							'Use the available width and calculate height from the aspect ratio. This scales on mobile but does not automatically measure Scribe content.',
							'scribe-embed-block'
						),
						checked: responsive,
						onChange: function (value) {
							updateAttribute('responsive', value);
						}
					}),

					!responsive ? el(TextControl, {
						key: 'width',
						label: __('Width', 'scribe-embed-block'),
						help: __(
							'Use a value such as 100%, 900px, or 80vw.',
							'scribe-embed-block'
						),
						value: attributes.width,
						onChange: function (value) {
							updateAttribute('width', value);
						}
					}) : null,

					!responsive ? el(RangeControl, {
						key: 'height',
						label: __('Height (pixels)', 'scribe-embed-block'),
						value: attributes.height,
						min: 200,
						max: 2000,
						step: 50,
						onChange: function (value) {
							updateAttribute('height', value || 800);
						}
					}) : null,

					el(RangeControl, {
						key: 'minHeight',
						label: __('Minimum height (pixels)', 'scribe-embed-block'),
						help: __(
							'Optional. A minimum height can override the aspect ratio on narrow screens; 0 disables it.',
							'scribe-embed-block'
						),
						value: attributes.minHeight,
						min: 0,
						max: 1200,
						step: 40,
						onChange: function (value) {
							updateAttribute(
								'minHeight',
								value === undefined ? 0 : value
							);
						}
					}),

					el(SelectControl, {
						key: 'aspectRatio',
						label: __('Aspect ratio', 'scribe-embed-block'),
						value: attributes.aspectRatio,
						options: [
							{
								label: __('16:12 (Scribe default)', 'scribe-embed-block'),
								value: '16 / 12'
							},
							{
								label: '16:9',
								value: '16 / 9'
							},
							{
								label: '4:3',
								value: '4 / 3'
							},
							{
								label: '1:1',
								value: '1 / 1'
							},
							{
								label: __('None (fixed height)', 'scribe-embed-block'),
								value: 'none'
							}
						],
						onChange: function (value) {
							updateAttribute('aspectRatio', value);
						}
					}),

					el(ToggleControl, {
						key: 'skipIntro',
						label: __('Skip intro screens', 'scribe-embed-block'),
						help: __(
							'Adds Scribe’s skipIntro=true embed option.',
							'scribe-embed-block'
						),
						checked: !!attributes.skipIntro,
						onChange: function (value) {
							updateAttribute('skipIntro', value);
						}
					}),

					el(ToggleControl, {
						key: 'removeLogo',
						label: __('Remove Scribe logo', 'scribe-embed-block'),
						help: __(
							'Adds Scribe’s removeLogo=true embed option.',
							'scribe-embed-block'
						),
						checked: !!attributes.removeLogo,
						onChange: function (value) {
							updateAttribute('removeLogo', value);
						}
					}),



					el(TextControl, {
						key: 'frameTitle',
						label: __('Iframe title (accessibility)', 'scribe-embed-block'),
						value: attributes.frameTitle,
						onChange: function (value) {
							updateAttribute('frameTitle', value);
						}
					})
				];
			}

			return el(
				Fragment,
				{},

				// Main Scribe settings panel.
				el(
					InspectorControls,
					{},
					el(
						PanelBody,
						{
							title: __('Scribe settings', 'scribe-embed-block'),
							initialOpen: true
						},
						renderSettings()
					)
				),

// WordPress built-in Advanced panel.
				el(
					InspectorAdvancedControls,
					{},

					el(ToggleControl, {
						label: __('Prohibit fullscreen', 'scribe-embed-block'),

						help: __(
							'Prevent viewers from entering fullscreen mode in the Scribe embed.',
							'scribe-embed-block'
						),

						checked: !!attributes.prohibitFullscreen,

						onChange: function (value) {
							updateAttribute('prohibitFullscreen', value);
						}
					}),

					el(ToggleControl, {
						label: __('Lazy-load the iframe', 'scribe-embed-block'),

						help: __(
							'Delay loading the Scribe guide until it approaches the visible area of the page.',
							'scribe-embed-block'
						),

						checked: attributes.lazyLoad !== false,

						onChange: function (value) {
							updateAttribute('lazyLoad', value);
						}
					})
				),

				// Main block editor interface.
				el(
					'div',
					blockProps,

					el(
						'div',
						{
							className: 'scribe-embed-editor__heading'
						},

						el('span', {
							className: 'dashicons dashicons-format-video',
							'aria-hidden': 'true'
						}),

						el(
							'strong',
							{},
							__('Scribe Embed', 'scribe-embed-block')
						)
					),

					el(TextControl, {
						label: __('Scribe URL', 'scribe-embed-block'),

						help: __(
							'Paste a Scribe viewer/share URL or its /embed/ URL.',
							'scribe-embed-block'
						),

						placeholder: 'https://scribehow.com/o/…/viewer/…',
						value: attributes.url,

						onChange: function (value) {
							setAttributes({ url: value });
						}
					}),

					attributes.url && !validUrl
						? el(
							Notice,
							{
								status: 'error',
								isDismissible: false
							},
							__(
								'Enter a valid HTTPS Scribe URL on scribehow.com.',
								'scribe-embed-block'
							)
						)
						: null,

					validUrl
						? el(
							Fragment,
							{},

							el(
								'div',
								{
									className: 'scribe-embed-editor__preview-heading'
								},

								el(
									'strong',
									{},
									__('Scribe Preview', 'scribe-embed-block')
								),

								el(
									'span',
									{},
									__('Changes to the block settings update this preview.', 'scribe-embed-block')
								)
							),

							el(
								'div',
								{
									className: 'scribe-embed-editor__preview-frame'
								},

								el('iframe', {
									key: embedUrl,
									src: embedUrl,
									title: attributes.frameTitle || 'Scribe guide',
									style: getPreviewStyles(attributes),
									allow: !attributes.prohibitFullscreen
										? 'fullscreen'
										: undefined,
									allowFullScreen: !attributes.prohibitFullscreen,
									loading: attributes.lazyLoad
										? 'lazy'
										: 'eager'
								})
							),

							el(
								'p',
								{
									className: 'scribe-embed-editor__hint'
								},
								__(
									'If the preview does not load, Scribe may restrict iframe embedding or require authentication.',
									'scribe-embed-block'
								)
							)
						)
						: null,

					!attributes.url
						? el(
							'p',
							{
								className: 'scribe-embed-editor__hint'
							},
							__(
								'Enter a Scribe URL to preview the guide. Additional settings are available in the block sidebar.',
								'scribe-embed-block'
							)
						)
						: null
				)
			);
		},

		save: function () {
			// Dynamic block: PHP validates attributes and renders the iframe.
			return null;
		}
	});
})(window.wp);