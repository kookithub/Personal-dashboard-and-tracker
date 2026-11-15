# User guide

Everything you can do in the app, and where to find it. Back to the [README](../README.md).

## Everyday
- **Guest mode**: the login screen has "Look around as a guest": the full dashboard with made-up sample data.
  Nothing a guest does is saved or sent to the server, and none of your data is shown.
- Open the site on your iPhone in Safari, then Share > **Add to Home Screen** so it opens like an app.
- Notes are still Markdown. Tap a note to read it and tick tasks, or tap Edit to change it.
- Nothing disappears straight away. Deleted notes go to the **Trash** (Recent tab, or Settings > Account), and
  so do deleted tasks (with their steps) and pictures nothing uses any more (an old wallpaper, a removed
  picture widget or buddy), a few hours after.
  Everything stays there **30 days** and can be put back, then it is deleted for good. "Clear list" on the
  Recent tab only hides the list (Show all brings it back); it never deletes notes. Deleting or ticking a task shows an **Undo** button.
- Projects, courses and ongoing notes have a **Status** switch at the top of the note (Active, Paused, Done, Archived).
  Anything not active moves to its own section ("Done & paused projects", "Past courses", "Stopped & paused"),
  folded on Home and open on its own tab.
- Ticked tasks are kept under **Done** on the Tasks tab, finished exams under each course, and finished homework
  behind "Show finished".
- Settings > **Download backup** saves every note as one JSON file.

## Making it yours
Everything below is changed in the app and saved in the database: no code change and no deploy.

### Settings (sliders icon) > Look
Changes show at once; press **Save** to keep them (Cancel / closing undoes them).
- **Mode**: Light or Dark, saved on each device. Every theme has both.
- **Moving background on this device**: On / Off for Hyper's and Zeus' moving backgrounds, per device (saves battery
  and graphics memory; turn it off on a phone that struggles). **Crash fallback:** if the page crashes 3 times in a row
  within 20 seconds of opening (a phone running out of graphics memory reloads again and again), it switches itself
  off on that device and says so after you log in. Switch it back on here.
- **Theme**: one list in three groups. Tap a theme to use it.
  - **Classic**: calm color palettes (Classic, Sage, Ocean, Rose, Plum, Forest, Sunset, Lagoon, Cherry, Mono) with your
    own colors and wallpaper.
  - **Hyper**: neon bands of light and a live ticker of your own numbers.
  - **Zeus**: the Greek gods, lightning, laurel and Greek key.
  - **Classic, Hyper and Zeus themselves are base themes and can never be removed**, so each group always has one to
    copy. Other built-in palettes can be removed ("Bring back removed" returns them).
  - **New theme (copy of this one)** makes your own theme from the one you're on, in the same group; then rename,
    change or remove it.
- **Customize · (theme name)**: everything here is saved with that theme only.
  - Classic themes: **colors** (accent, second color, background; for the mode you're in), **wallpaper picture**
    (upload or https link) with **Soften the picture**, or a **pattern** (Glow, Plain, Mesh, Dots, Grid) without one.
  - Hyper: **Bands** (Neon trail, or Ribbon: solid bands, each in a color you pick, flashing to the others' colors),
    **band colors** (Neon, Fire, Ice, Toxic, Mono) or the ribbon colors, **background** (theme or any color). Under
    **Fine-tune the effects**: number of bands, band speed, width, light streak speed, glow / shadow, **flash rate**
    (ribbons; above 3 flashes a second it warns about photosensitive epilepsy and asks first), and strobe, scan line,
    grid floor and ticker on or off.
  - Zeus: **slideshow** (the Greek gods, or **Your own**: videos and pictures you upload, in the order you set; videos
    play muted to their end, up to 30 MB each, MP4 plays on every device), lightning (Off, Some, Storm), how fast the
    pictures change, rising sparks, floating bolts. Each Zeus theme keeps its own set: copy the theme for another set.
  - Every theme: **font style** (Studio, Modern, Rounded, Typewriter, Neon, Grotesk), **corners** (Round, Soft,
    Square), **card decoration** (Ribbon, Glow, Sticker, Chase, Greek, Plain), **cards** (Solid, Glass, Clear).
- **Logo** (icon, letters/emoji or your own picture; also the browser tab and home-screen icon), one for all themes.
- Phones get a lighter Zeus (fewer bolts, sparks and clouds) automatically.

### Customize (pencil icon): the open tab
- **Page heading**: the tab's heading and the small line above it turn into text boxes (for example Tasks:
  "everything on your plate"). Empty brings back the default. Home can have one too.
- Drag the grip to move anything, × takes it off (with Undo), **pencil > Change** changes it:
  width, which tab it's on, **box color** (Theme, Glass, Clear, or any color) and, for built-in cards, **their texts**:
  titles ("All tasks", "Active projects", "Past courses", "Tasks with steps"…) and, on the **Clock & greeting** card,
  the **line above the greeting** (empty shows the day of the week) and the morning / afternoon / evening / night /
  after-midnight greetings.
- In any text, `*stars*` around a word give it the colored italic style (as in "Good *morning*").
- **Add to this tab** offers widgets (picture, sticky note, countdown, world clock, weather, links, a note, an
  embed: paste a link or the embed code a site gives you under Share > Embed, e.g. `<iframe …>`; **music keeps
  playing when you switch tabs or open a note**, and a small ♪ button brings the player up from anywhere, with Stop),
  (Spotify plays full songs in Chrome, Edge or Firefox; in Safari only 30-second previews, see "Spotify in Safari").
  **section headings**, and every built-in card (calendar, tasks, projects, courses…), so any tab can show
  anything. Picture shapes: **As is**, Square, Wide, Tall, Fill card.

### Settings > Home, Buddy, Calendars, Account
- **Home**: the title in the top bar, **tabs** (make your own, rename built-in ones, pick icons, reorder, untick to
  take one out of the dock; what's on it is kept), and the Life links.
- **Buddy**: up to 6 little characters that explore (jump onto cards), walk, wander, peek in from the sides or bounce
  in a corner, with how restless (calm / lively / hyper), speed and size. Tap one and it says one of your lines
  (`{due}` / `{overdue}` become your task counts). Built-in (pixel cat, pixel bunny, blob, cat, ghost) or your own
  picture: an animated GIF up to ~1 MB keeps moving, "Pixel art" keeps pixels sharp, "Frames" plays a sprite strip.
- **Calendars**: Google Calendar secret iCal links and homework iCal links from your school (Canvas, Moodle…), one per line.
- **Account**: **Signed-in devices**, Download backup, Trash, log out.
  - **Signed-in devices** lists every device logged in (iPhone · Safari, Windows · Chrome…, with city/country, IP
    address, when it signed in and was last used), with **Log out** for each one or all others at once, plus every
    wrong password tried in the last 30 days. Opening the app warns you when a new device signed in or a wrong password
    was tried since you last looked.

All of it is saved in the `dashboard` setting (layout in `lib/layout.js`, themes in `lib/theme.js`).

## Spotify in Safari (only previews)
Safari keeps Spotify's login away from players inside other sites, and Spotify's player doesn't ask Safari for it, so
in Safari (iPhone, iPad, Mac) the Spotify card plays 30-second previews. Other browsers play full songs when you are
logged in to Spotify there. YouTube and other players are not affected.

## Forgot the password? (or a lost phone)
The password is not stored anywhere you can read it, but you can set a new one with only your **Cloudflare login**.
Your notes and settings are not touched.
1. Log in at **dash.cloudflare.com**.
2. **Workers & Pages** > **home-dashboard** > **Settings** > **Variables and Secrets**.
3. Next to **APP_PASSWORD**, choose **Edit**, type the new password, and **Deploy** / save.
4. Log in on the site with the new password (if it says "Too many tries", wait 15 minutes).

**To log every device out** (a lost or stolen phone): edit **SESSION_SECRET** the same way and set it to any new
long random text. Every device then has to log in again. Changing APP_PASSWORD alone does not log devices out.
From a PC the same can be done with `npx wrangler secret put APP_PASSWORD` / `SESSION_SECRET`.
Keep your Cloudflare account safe (two-step login): it is the key to everything.
