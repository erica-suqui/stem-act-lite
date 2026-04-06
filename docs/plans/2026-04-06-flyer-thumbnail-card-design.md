# Flyer Thumbnail on Event Cards — Design

**Date:** 2026-04-06
**Branch:** feat/form-polish

## Problem

Flyers uploaded by event partners are only accessible as a plain text link ("View Flyer") inside the event detail dialog. Users browsing the events page have no visual indication that a flyer exists.

## Goal

Show a flyer thumbnail at the top of each event card on the public events page, making flyers immediately visible without requiring the user to open the detail dialog.

## Approach

Add a `CardMedia` section at the top of each event card in `PublicEventsClient.js`.

### Image flyers (jpg, jpeg, png, gif, webp)
- Render using MUI `CardMedia` with `component="img"` and `object-fit: cover`
- Fixed height of 160px
- Alt text: `"Flyer for {event.title}"`

### PDF flyers
- Render a styled placeholder `Box` (grey background, 160px tall) with a centered PDF icon and "PDF Flyer" label
- Include a `// TODO` comment: when the backend is connected, a server-side thumbnail generation endpoint (e.g. `GET /api/events/:id/flyer-thumbnail`) could generate a first-page preview image to replace this placeholder

### No flyer
- Card is unchanged from current state

## Scope

- **Only file changed:** `stemApp/app/components/PublicEventsClient.js`
- No backend changes required
- Detail dialog unchanged (keeps existing "View Flyer" link)

## Trade-offs

- Cards with flyers will be taller than cards without. This is acceptable and consistent with standard event listing patterns.
- PDF thumbnails require server-side rendering (e.g. pdf2pic, Puppeteer) which is out of scope until the backend service layer is in place.
