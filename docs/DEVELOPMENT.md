# Development notes

Where each feature lives and the limits that shaped it, for anyone working on the code.
(Next.js 16 + React, on Cloudflare Workers with a D1 database, one password.) See the [README](../README.md) for setup
and commands, and the [user guide](GUIDE.md) for what the app does.

## How it gets published
- If your copy is connected to Cloudflare's GitHub builds, every push to `main` publishes the site a few minutes later
  (Cloudflare > the Worker > Deployments).
- `npm run deploy` from a PC (after `npx wrangler login`) works too.
- Nothing needs a manual database change: the server adds the newer column (`blobs.trashed_at`) and tables (`video_parts`, `sessions`, `login_log`) by itself.

## What the app has now (all changeable in the app, saved in the database, no deploy needed)
- **Tabs and layout** (`lib/layout.js`): own tabs, rename/reorder/hide tabs, any card/widget/section heading on any tab,
  drag to move, widths. Pencil button = customize; Settings > Home = tabs.
- **Own texts**: in Customize, a tab's heading and the line above it are text boxes (`tab_info[tab].head/sub`);
  built-in cards' titles (and the Clock & greeting card's line and greetings) are changed with the card's pencil (`text` on the layout item, `CARDS[..].text` in `lib/layout.js`).
- **Widgets** (`components/widgets.jsx`): picture (shapes: as is / square / wide / tall / fill), sticky note, countdown,
  world clock, weather, links, note, embed, section heading.
- **Projects / courses / ongoing** have a Status switch at the top of the note. Not-active ones move to their own
  section ("Done & paused projects", "Past courses", "Stopped & paused"), never hidden.
- **Undo** after ticking or deleting a task, and after moving a note to the trash.
- **Trash, 30 days** (`components/TrashDialog.jsx`, `lib/server.js` tidyUp): deleted notes, deleted tasks (kept in the
  `task_bin` setting) and pictures nothing uses any more. The server tidies up at most every 6 hours when notes load,
  and deletes what has been in the bin 30 days.
- **Themes** (`lib/theme.js`, `components/SkinBackdrop.jsx`, the end of `app/globals.css`): Light/Dark per device
  (no Auto). Hyper and Zeus are themes like the palettes, each with a light and dark version. Every theme keeps its
  own font style, corners and card decoration. Classic (the terracotta palette), Hyper and Zeus are base themes that can't be removed
  (copy one to make your own). Moving backgrounds animate only `transform` and `opacity`
  (no backdrop blur, blend modes, animated filters or per-frame gradient redraws): that is what keeps them light on
  phones. Measured with Chrome tracing: Hyper went from ~1800 ms of drawing per second to ~4.
- **Zeus' own slideshow** (Settings > Look > Zeus > Slideshow > Your own): `zs.show` / `zs.own` per theme
  (`lib/theme.js`), played by `OwnSlides` in `components/SkinBackdrop.jsx` (one slide on the page, two while they
  cross-fade). Videos are uploaded in 1 MB parts (`uploadVideo` in `components/AppProvider.jsx`, `/api/video`), kept in
  the `video_parts` table (created by the server itself) and served as byte ranges from `/api/blob/…`, one part per
  request. Their `blobs` row holds only `{ size, parts }`; the bin and tidy-up treat them like pictures.
- **Embeds keep playing across tabs** (`components/EmbedHost.jsx`, wraps the app in `app/layout.jsx`): the iframes
  live in one layer that never unmounts; a widget only leaves an `EmbedSlot` placeholder and each frame is laid over
  its slot every animation frame (or moved out of sight, still playing). Moving an iframe in the DOM would reload it.
- **Embed widget** (`parseEmbed` / `embedFor` in `components/widgets.jsx`): a link or pasted embed code; only the
  iframe's address and height are kept. Known sites' links (YouTube, Spotify, Vimeo, TikTok, Instagram, X, SoundCloud,
  Apple Music, Google Docs/Slides/Maps) become their embed address.
- **Signed-in devices** (`components/DevicesDialog.jsx`, sessions in `lib/server.js`): each login is a `sessions` row,
  the cookie is `<id>.<hmac>`; deleting the row logs that device out. Wrong passwords go to `login_log` (30 days).
  `checkSignIns` (called from `components/Gate.jsx`) warns about new sign-ins since this device last looked.
- **Public demo**: `npm run deploy:demo` builds with `NEXT_PUBLIC_DEMO=1` (`DEMO` in `components/AppProvider.jsx`):
  straight into guest mode, and the API answers nothing. Uses `wrangler.demo.jsonc` (no database).
- **Buddies** (`components/Buddy.jsx`, Settings > Buddy): up to 6 characters that walk, wander, explore (jump on cards),
  peek or bounce. Built-in originals (pixel cat, pixel bunny, blob, cat, ghost) or the user's own uploaded pictures
  (GIFs stay animated; sprite strips via "Frames"; "Pixel art" keeps pixels sharp).

## Phones
- iPhone Safari has little graphics memory: Hyper shows as Hyper there too (no Zeus swap any more; turn off Settings > Look > Moving background on this device if it struggles),
  big moving pictures are drawn into small canvases (`Painted` in `components/SkinBackdrop.jsx`), and if the page
  crashes three times right after opening, moving backgrounds switch off on that device (`k-motion`).
- Measure graphics memory before adding moving layers: every full-screen layer costs ~12 MB on a 3x phone screen.

## Free plan notes
- Workers free plan: 10 ms CPU per request. Pictures are decoded with `Buffer` (fast); don't go back to decoding
  base64 character by character (that took ~110 ms for a 1 MB picture).
- Everything else is small: a few requests per visit, about one database row read per note per visit.

## Changes that still need code (and a merge)
- New kinds of widgets, cards or features; renaming the main folders the app looks for (Projects, Academic, Life, Daily).

## Notes for working on it
- Local test (open it at `http://localhost:8787`, not 127.0.0.1, or saving is refused as another site): create `.dev.vars` with `APP_PASSWORD=...` and `SESSION_SECRET=...`, run
  `npx wrangler d1 execute home-dashboard --local --file schema.sql`, then `npm run dev` (Node) or
  `npx opennextjs-cloudflare build && npx wrangler dev` (the real Workers runtime). The local database is separate from the live one.
- `AGENTS.md` is written by `next dev`; keep it committed.
- Settings > Account > **Download backup** saves every note and setting as one JSON file. Keep a recent one somewhere safe.
