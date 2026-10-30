(function (wp) {
	'use strict';

	var el = wp.element.createElement;
	var Fragment = wp.element.Fragment;
	var registerBlockType = wp.blocks.registerBlockType;
	var __ = wp.i18n.__;
	var InspectorControls = wp.blockEditor.InspectorControls;
	var useBlockProps = wp.blockEditor.useBlockProps;
	var PanelBody = wp.components.PanelBody;
	var TextControl = wp.components.TextControl;
	var SelectControl = wp.components.SelectControl;
	var RangeControl = wp.components.RangeControl;
	var ToggleControl = wp.components.ToggleControl;
	var Notice = wp.components.Notice;

	/**
	 * Validate Scribe URLs before accepting them in the editor.
	 *
	 * The PHP renderer performs its own validation, so this is
	 * an editor convenience rather than the security boundary.
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
			allowFullscreen: {
				type: 'boolean',
				default: true
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

			var blockProps = useBlockProps({
				className: 'scribe-embed-editor'
			});

			return el(
				Fragment,
				{},

				// Sidebar settings.
				el(
					InspectorControls,
					{},

					el(
						PanelBody,
						{
							title: __('Scribe settings', 'scribe-embed-block'),
							initialOpen: true
						},

						el(SelectControl, {
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
								setAttributes({ mode: value });
							}
						}),

						el(ToggleControl, {
							label: __('Responsive sizing', 'scribe-embed-block'),

							help: __(
								'Use the available width and calculate height from the aspect ratio. This scales on mobile but does not automatically measure Scribe content.',
								'scribe-embed-block'
							),

							checked: responsive,

							onChange: function (value) {
								setAttributes({ responsive: value });
							}
						}),

						!responsive ? el(TextControl, {
							label: __('Width', 'scribe-embed-block'),

							help: __(
								'Use a value such as 100%, 900px, or 80vw.',
								'scribe-embed-block'
							),

							value: attributes.width,

							onChange: function (value) {
								setAttributes({ width: value });
							}
						}) : null,

						!responsive ? el(RangeControl, {
							label: __('Height (pixels)', 'scribe-embed-block'),

							value: attributes.height,
							min: 200,
							max: 2000,
							step: 50,

							onChange: function (value) {
								setAttributes({
									height: value || 800
								});
							}
						}) : null,

						el(RangeControl, {
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
								setAttributes({
									minHeight: value === undefined ? 0 : value
								});
							}
						}),

						el(SelectControl, {
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
								setAttributes({ aspectRatio: value });
							}
						}),

						el(ToggleControl, {
							label: __('Skip intro screens', 'scribe-embed-block'),

							help: __(
								'Adds Scribe’s skipIntro=true embed option.',
								'scribe-embed-block'
							),

							checked: !!attributes.skipIntro,

							onChange: function (value) {
								setAttributes({ skipIntro: value });
							}
						}),

						el(ToggleControl, {
							label: __('Remove Scribe logo', 'scribe-embed-block'),

							help: __(
								'Adds Scribe’s removeLogo=true embed option.',
								'scribe-embed-block'
							),

							checked: !!attributes.removeLogo,

							onChange: function (value) {
								setAttributes({ removeLogo: value });
							}
						}),

						el(ToggleControl, {
							label: __('Allow fullscreen', 'scribe-embed-block'),

							checked: !!attributes.allowFullscreen,

							onChange: function (value) {
								setAttributes({ allowFullscreen: value });
							}
						}),

						el(ToggleControl, {
							label: __('Lazy-load the iframe', 'scribe-embed-block'),

							checked: !!attributes.lazyLoad,

							onChange: function (value) {
								setAttributes({ lazyLoad: value });
							}
						}),

						el(TextControl, {
							label: __('Iframe title (accessibility)', 'scribe-embed-block'),

							value: attributes.frameTitle,

							onChange: function (value) {
								setAttributes({ frameTitle: value });
							}
						})
					)
				),

				// Main block editor interface.
				el(
					'div',
					blockProps,

					el(
						'div',
						{ className: 'scribe-embed-editor__heading' },

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
							'Paste a Scribe viewer/share URL or its /embed/ URL. The block generates the iframe for you.',
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
							Notice,
							{
								status: 'success',
								isDismissible: false
							},
							__(
								'Scribe URL accepted. The embed will appear on the published page.',
								'scribe-embed-block'
							)
						)
						: null,

					el(
						'p',
						{ className: 'scribe-embed-editor__hint' },
						__(
							'Scribes shared only with a team or organization may require viewers to sign in to Scribe.',
							'scribe-embed-block'
						)
					)
				)
			);
		},

		save: function () {
			// Dynamic block: PHP validates attributes and renders the iframe.
			return null;
		}
	});
})(window.wp);