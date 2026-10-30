# Scribe Embed Block

A small Gutenberg block plugin for embedding Scribe guides without asking authors to use the Custom HTML block.

## Features

- Accepts HTTPS Scribe viewer/share URLs and Scribe embed URLs on `scribehow.com`.
- Generates the iframe on the server from a strict allow-list of Scribe URL patterns.
- Supports Scribe's `Video`, `Slides`, and `Scroll` display modes.
- Configurable width, height, minimum height, and aspect ratio.
- Toggle fullscreen permission and lazy loading.
- Editable iframe title for accessibility.
- Disables HTML editing for this block; it does not change the permissions or behaviour of the Custom HTML block.

## Install

1. In WordPress, open **Plugins → Add New Plugin → Upload Plugin**.
2. Upload `scribe-embed-block.zip` and activate it.
3. In the block editor, add **Scribe Embed** from the **Embeds** category.
4. Paste the Scribe URL. Open **Scribe settings** in the block sidebar to choose the display mode and size.

## Accepted URL forms

- `https://scribehow.com/o/ORGANIZATION_ID/viewer/DOCUMENT_SLUG`
- `https://scribehow.com/viewer/DOCUMENT_SLUG`
- `https://scribehow.com/shared/DOCUMENT_SLUG`
- `https://scribehow.com/embed/DOCUMENT_SLUG`

The plugin rejects non-HTTPS URLs, other hosts, unknown path shapes, and malformed document identifiers. It ignores query parameters from the pasted URL and builds the embed URL with the selected `as=video`, `as=slides`, or `as=scroll` mode. This prevents an author from using this block to point an iframe at an arbitrary site.

## Sharing and access

The Scribe itself must be shared in a way that permits the intended audience to view it. Scribes restricted to a team or organization may prompt viewers to sign in. The plugin does not change Scribe permissions.

## Requirements

- WordPress 6.3 or later
- PHP 7.4 or later
