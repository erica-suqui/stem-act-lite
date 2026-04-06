# Flyer Thumbnail on Event Cards — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show a flyer thumbnail at the top of each event card on the public events page.

**Architecture:** Add a `CardMedia` block above `CardContent` in each event card inside `PublicEventsClient.js`. Image flyers render as a real thumbnail; PDF flyers render a styled placeholder with a PDF icon. Cards with no flyer are unchanged.

**Tech Stack:** Next.js 14, MUI v5 (`CardMedia`, `Box`), `@mui/icons-material`

---

### Task 1: Add flyer thumbnail to event cards

**Files:**
- Modify: `stemApp/app/components/PublicEventsClient.js`

**Step 1: Add `PictureAsPdf` to the MUI icons import**

In the existing icons import at the top of the file, add `PictureAsPdfIcon`:

```js
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
```

**Step 2: Add a helper to detect image vs PDF flyer**

Add this above the `export default` line:

```js
function isImageUrl(url) {
  return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);
}
```

**Step 3: Add the thumbnail block to the card**

Inside the `<Card>` component (around line 170), add the following immediately before `<CardContent>`:

```jsx
{event.flyer_url && (
  isImageUrl(event.flyer_url) ? (
    <CardMedia
      component="img"
      height="160"
      image={event.flyer_url}
      alt={`Flyer for ${event.title}`}
      sx={{ objectFit: 'cover' }}
    />
  ) : (
    // TODO: When backend thumbnail generation is available, replace this placeholder
    // with an <img> from a server-side endpoint e.g. GET /api/events/:id/flyer-thumbnail
    // that renders the first page of the PDF as an image (e.g. using pdf2pic or Puppeteer).
    <Box
      sx={{
        height: 160,
        bgcolor: 'grey.100',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <PictureAsPdfIcon sx={{ fontSize: 40, color: 'grey.400' }} />
      <Typography variant="caption" color="text.secondary">PDF Flyer</Typography>
    </Box>
  )
)}
```

**Step 4: Add `CardMedia` to the MUI import**

Add `CardMedia` to the existing MUI import at the top of the file:

```js
import {
  Box, Grid, Card, CardContent, CardActions, CardMedia, Typography,
  ...
} from '@mui/material';
```

**Step 5: Manually verify**

Start the dev server:
```bash
cd stemApp && npm run dev
```

- Navigate to the events page
- Confirm cards with image flyers show the image thumbnail at the top
- Confirm cards with PDF flyers show the grey placeholder with PDF icon
- Confirm cards with no flyer are unchanged
- Click a card with a flyer — confirm detail dialog still opens normally

**Step 6: Commit**

```bash
git add stemApp/app/components/PublicEventsClient.js
git commit -m "feat: show flyer thumbnail on event cards"
```
