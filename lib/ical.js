// Reads Google Calendar / school homework iCal text into { "YYYY-MM-DD": [events] }.
import { M, dayKey } from "./notes";

function icsDate(v) {
  if (/^\d{8}$/.test(v)) return { m: M(v, "YYYYMMDD"), allDay: true };
  if (/Z$/.test(v)) return { m: M.utc(v, "YYYYMMDDTHHmmss[Z]").local(), allDay: false };
  return { m: M(v, "YYYYMMDDTHHmmss"), allDay: false };
}

function parseIcs(text) {
  const out = [];
  let ev = null;
  let alarm = false; // reminders inside an event have their own SUMMARY
  for (const line of text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/)) {
    if (line === "BEGIN:VEVENT") ev = { ex: [] };
    else if (line === "END:VEVENT") { if (ev?.start && !ev.cancelled) out.push(ev); ev = null; }
    else if (line === "BEGIN:VALARM") alarm = true;
    else if (line === "END:VALARM") alarm = false;
    else if (ev && !alarm) {
      const i = line.indexOf(":");
      if (i < 0) continue;
      const name = line.slice(0, i).split(";")[0];
      const val = line.slice(i + 1);
      if (name === "SUMMARY") ev.title = val.replace(/\\([,;\\])/g, "$1").replace(/\\n/gi, " ");
      else if (name === "DTSTART") ev.start = icsDate(val);
      else if (name === "RRULE") ev.rrule = val;
      else if (name === "EXDATE") val.split(",").forEach((x) => ev.ex.push(dayKey(icsDate(x).m)));
      else if (name === "STATUS" && val === "CANCELLED") ev.cancelled = true;
    }
  }
  return out;
}

function expandEvent(ev, from, to, into, hw) {
  const base = ev.start.m;
  const add = (m) => {
    const k = dayKey(m);
    if (ev.ex.includes(k) || m.isBefore(from, "day") || m.isAfter(to, "day")) return;
    (into[k] ||= []).push({ time: ev.start.allDay ? "" : m.format("HH:mm"), title: ev.title || "(no title)", hw });
  };
  if (!ev.rrule) return add(base);
  const r = Object.fromEntries(ev.rrule.split(";").map((p) => p.split("=")));
  const unit = { DAILY: "days", WEEKLY: "weeks", MONTHLY: "months", YEARLY: "years" }[r.FREQ];
  if (!unit) return add(base);
  const step = +r.INTERVAL || 1;
  const until = r.UNTIL ? icsDate(r.UNTIL).m : null;
  const count = +r.COUNT || Infinity;
  const byDay = r.FREQ === "WEEKLY" && r.BYDAY
    ? r.BYDAY.split(",").map((d) => ["SU", "MO", "TU", "WE", "TH", "FR", "SA"].indexOf(d.slice(-2))).filter((d) => d >= 0)
    : null;
  let n = 0;
  const start = base.clone();
  // Skip ahead to the shown range, so old repeating events still reach today.
  if (!r.COUNT && base.isBefore(from)) start.add(Math.max(0, Math.floor(from.diff(base, unit) / step) - 1) * step, unit);
  for (let cur = start, guard = 0; guard < 2000 && n < count; guard++, cur.add(step, unit)) {
    if ((until && cur.isAfter(until)) || cur.isAfter(to)) break;
    const hits = byDay ? byDay.map((d) => cur.clone().day(d)).filter((m) => !m.isBefore(base)).sort((a, b) => a - b) : [cur.clone()];
    for (const m of hits) {
      if ((until && m.isAfter(until)) || n >= count) break;
      n++;
      add(m);
    }
  }
}

export function buildEvents(calendars) {
  const today = M().startOf("day");
  const from = today.clone().subtract(2, "months");
  const to = today.clone().add(6, "months");
  const events = {};
  const errors = [];
  for (const c of calendars) {
    if (c.error) { errors.push(c.error); continue; }
    parseIcs(c.text).forEach((ev) => expandEvent(ev, from, to, events, c.hw));
  }
  Object.values(events).forEach((list) => list.sort((a, b) => (a.time || "").localeCompare(b.time || "")));
  return { events, errors };
}
