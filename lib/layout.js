// The dashboard's layout. All of it lives in the `dashboard` setting, so tabs, sections and
// cards are changed in the app (Customize, Settings > Home); the server never needs to change.
//
//   tabs:     ["overview", "tasks", "t-k3x9"]        tabs in the dock, in order
//   tab_info: { "t-k3x9": { name, icon }, tasks: { name: "To do", head, sub } }   own tabs, renamed built-in ones, own page headings
//   layout:   { overview: [item, …], … }               what each tab shows, in order
//
// An item is one of
//   { id, card: "calendar", size }           a built-in card (see CARDS)
//   { id, type: "heading", title }           a section heading
//   { id, type: "picture", src, shape, … }   a widget (components/widgets.jsx)
// A tab with no saved layout shows its defaults (plus widgets saved the older way, with a `tab` field).

export const BUILTIN_TABS = {
  overview: ["layout-dashboard", "Home"],
  tasks: ["list-checks", "Tasks"],
  academic: ["graduation-cap", "Study"],
  projects: ["folder-kanban", "Projects"],
  life: ["heart", "Life"],
  history: ["history", "Recent"],
};
// Page headings of the built-in tabs: [title, line above it].
export const TAB_HEADS = {
  overview: [null, null],
  tasks: ["*Tasks*", "everything on your plate"],
  academic: ["Study *hall*", "courses, exams and homework"],
  projects: ["*Projects*", "things you're building"],
  life: ["*Life*", "money, data and ongoing things"],
  history: ["*Recent*", "notes you edited lately"],
};
export const TAB_ICONS = [
  "star", "heart", "sparkles", "rocket", "target", "flag", "briefcase", "book-open", "graduation-cap", "brain",
  "lightbulb", "folder-kanban", "list-checks", "calendar-days", "wallet", "piggy-bank", "chart-line", "dumbbell",
  "utensils", "plane", "music", "film", "gamepad-2", "camera", "image", "leaf", "house", "coffee", "code", "history",
  "layout-dashboard", "inbox",
];

// Widths: [desktop columns of 6, phone columns of 6, label].
export const SIZES = { s: [2, 3, "Small"], m: [3, 6, "Half"], b: [4, 6, "Large"], l: [6, 6, "Full"] };
export const SIZE_OPTIONS = Object.fromEntries(Object.entries(SIZES).map(([k, v]) => [k, v[2]]));

// Built-in cards. `span` is the default width; `section` cards are full-width groups of tiles.
export const CARDS = {
  hero: { name: "Clock & greeting", icon: "clock", span: [4, 6],
    text: { line: "", morning: "Good *morning*", afternoon: "Good *afternoon*", evening: "Good *evening*", night: "Good *night*", late: "Still *up?*" } },
  links: { name: "Life links", icon: "heart", span: [2, 6], text: { title: "Life" } },
  upnext: { name: "Tasks", icon: "list-checks", span: [3, 6], text: { title: "Tasks" } },
  calendar: { name: "Calendar", icon: "calendar-days", span: [3, 6] },
  study: { name: "Exam prep", icon: "target", span: [2, 6], text: { title: "Exam prep" } },
  homework: { name: "Homework", icon: "book-open", span: [4, 6], text: { title: "Homework" } },
  alltasks: { name: "All tasks (big list)", icon: "list-checks", span: [6, 6], text: { title: "All tasks" } },
  recent: { name: "Recently edited", icon: "history", span: [6, 6], text: { title: "Recently edited" } },
  courses: { name: "Courses", icon: "graduation-cap", section: true, text: { title: "Your *courses*", off: "Past *courses*" } },
  coursedetail: { name: "Courses with exams", icon: "graduation-cap", section: true, text: { title: "Your *courses*", off: "Past *courses*" } },
  projects: { name: "Projects", icon: "folder-kanban", section: true, text: { title: "Active *projects*", off: "Done & paused *projects*" } },
  ongoing: { name: "Ongoing", icon: "sparkles", section: true, text: { title: "*Ongoing*", off: "Stopped & paused" } },
  bigtasks: { name: "Tasks with steps", icon: "layers", section: true, text: { title: "Tasks with *steps*" } },
  lifelinks: { name: "Life links (big tiles)", icon: "heart", section: true, text: { title: "Life *links*" } },
};
// Labels for the editable texts of the built-in cards (pencil > Change). Wrap a word in *stars* to style it.
export const TEXT_LABELS = {
  line: "Line above the greeting", title: "Title", off: "Title of the done / paused part",
  morning: "Morning greeting", afternoon: "Afternoon greeting", evening: "Evening greeting", night: "Night greeting", late: "After midnight",
};
// A card's text: its own (saved on the layout item as `text`) or the default.
export const cardText = (it, key) => String(it?.text?.[key] || CARDS[it?.card]?.text?.[key] || "");

const DEFAULTS = {
  overview: ["hero", "links", "upnext", "calendar", "study", "homework", "courses", "projects", "ongoing"],
  tasks: ["alltasks", "bigtasks"],
  academic: [["study", "s"], ["homework", "b"], "coursedetail"],
  projects: ["projects"],
  life: ["lifelinks", "ongoing"],
  history: ["recent"],
};

export const newId = () => Math.random().toString(36).slice(2, 9);

const validItem = (it) => it && typeof it === "object" && (it.card ? !!CARDS[it.card] : !!it.type);

export function getLayout(dash, tab) {
  if (Array.isArray(dash.layout?.[tab])) return dash.layout[tab].filter(validItem);
  const hidden = tab === "overview" && Array.isArray(dash.hidden) ? dash.hidden : [];
  const cards = (DEFAULTS[tab] || [])
    .map((c) => (Array.isArray(c) ? c : [c]))
    .filter(([card]) => !hidden.includes(card))
    .map(([card, size]) => ({ id: "c-" + card, card, ...(size ? { size } : {}) }));
  const widgets = (Array.isArray(dash.widgets) ? dash.widgets : [])
    .map((w, i) => [w, i])
    .filter(([w]) => w && w.type && (w.tab || "overview") === tab)
    .map(([w, i]) => { const { tab: _t, ...rest } = w; return { id: "w-" + i, ...rest }; }); // eslint-disable-line no-unused-vars
  return [...cards, ...widgets];
}

// The dashboard setting with new layouts for some tabs. Widgets saved the older way for
// those tabs are now part of the layout, so they are dropped from the old list.
export function withLayouts(dash, patch) {
  const next = { ...dash, layout: { ...(dash.layout || {}), ...patch } };
  const tabs = Object.keys(patch);
  if (Array.isArray(dash.widgets)) {
    next.widgets = dash.widgets.filter((w) => w && !tabs.includes(w.tab || "overview"));
    if (!next.widgets.length) delete next.widgets;
  }
  if (tabs.includes("overview")) delete next.hidden;
  for (const t of tabs) if (patch[t] === undefined) delete next.layout[t];
  return next;
}

/* ---------- tabs ---------- */

// Every tab, shown or not: [{ id, name, icon, custom, shown }], shown ones first in dock order.
export function tabList(dash) {
  const info = dash.tab_info && typeof dash.tab_info === "object" ? dash.tab_info : {};
  const known = (id) => id in BUILTIN_TABS || !!info[id]?.name;
  const make = (id, shown) => ({
    id, shown,
    custom: !(id in BUILTIN_TABS),
    name: String(info[id]?.name || BUILTIN_TABS[id]?.[1] || id),
    icon: String(info[id]?.icon || BUILTIN_TABS[id]?.[0] || "star"),
    // Own page heading and the line above it (Customize); empty = the default.
    head: String(info[id]?.head || ""), sub: String(info[id]?.sub || ""),
  });
  const shown = [...new Set((Array.isArray(dash.tabs) ? dash.tabs : Object.keys(BUILTIN_TABS)).map((t) => String(t).toLowerCase().trim()))]
    .filter(known);
  if (!shown.length) shown.push("overview");
  const rest = [...Object.keys(BUILTIN_TABS), ...Object.keys(info)].filter((id) => known(id) && !shown.includes(id));
  return [...shown.map((id) => make(id, true)), ...[...new Set(rest)].map((id) => make(id, false))];
}
export const shownTabs = (dash) => tabList(dash).filter((t) => t.shown).map((t) => t.id);
export const tabMeta = (dash, id) => tabList(dash).find((t) => t.id === id) || { id, name: id, icon: "star", custom: true };

// [title, line above] for a tab's page heading: the tab's own (set in Customize), else the default.
export function tabHead(dash, id) {
  const t = tabMeta(dash, id);
  const def = TAB_HEADS[id] && t.name === BUILTIN_TABS[id][1] ? TAB_HEADS[id] : id === "overview" ? [null, null] : [`*${t.name}*`, null];
  return [t.head || def[0], t.sub || def[1]];
}
// The default heading, for placeholders.
export const defaultHead = (dash, id) => tabHead({ ...dash, tab_info: { ...(dash.tab_info || {}), [id]: { ...(dash.tab_info?.[id] || {}), head: "", sub: "" } } }, id);
