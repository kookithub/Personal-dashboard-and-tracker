"use client";
// The cards on the dashboard.
import { useEffect, useRef, useState } from "react";
import { M, clean, dayKey, dueField, edit, fileName, isActive, pct, statusOf } from "@/lib/notes";
import { store } from "@/lib/theme";
import { useApp } from "./AppProvider";
import { useBoard, useNav } from "./board";
import { Bar, Btn, Empty, Fancy, Field, FoldGroup, Ico, IconBtn, Modal, ModalButtons, Ring, Tile, useCardItem, useCardText, useDialogs, useFold } from "./ui";

export const HUES = ["--violet", "--blue", "--cyan", "--green", "--amber", "--pink"];
export const hue = (i) => `var(${HUES[((i % HUES.length) + HUES.length) % HUES.length]})`;

/* ---------- tasks ---------- */

export function TaskRow({ x, source = true, del = false }) {
  const { processFile, deleteTask } = useApp();
  const { today, dueLabel } = useBoard();
  const { openPath } = useNav();
  const { confirm } = useDialogs();
  const [flip, setFlip] = useState(null); // shown at once, before the save finishes
  const done = flip ?? !!x.t.completed;
  useEffect(() => setFlip(null), [x.t.completed]);
  const late = !done && x.d && x.d.isBefore(today);
  // Ticking shows an Undo, since the task then moves to the Done list.
  const toggle = async () => {
    const next = !done;
    setFlip(next);
    const ok = await processFile(x.t.path, edit.done(x.t, next), next ? `Done: ${clean(x.t)}` : null);
    if (!ok) setFlip(null);
  };
  return (
    <div className={"b-task" + (done ? " done" : "")}>
      <div className={"b-chk" + (done ? " on" : "")} role="checkbox" aria-checked={done} aria-label="done" tabIndex={0}
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); } }}>
        {done && <Ico name="check" />}
      </div>
      <div className="b-task-m" onClick={() => openPath(x.t.path)}>
        <div className="b-task-t">{clean(x.t)}</div>
        {((x.d && !done) || source) && (
          <div className="b-task-s">
            {x.d && !done && (
              <span className={"b-chip" + (late ? " red" : x.d.isSame(today, "day") ? " acc" : "")}>{dueLabel(x.d)}</span>
            )}
            {source && <span>{fileName(x.t.path)}</span>}
          </div>
        )}
      </div>
      {del && (
        <IconBtn icon="trash-2" label="Delete" className="sm b-del"
          onClick={() => confirm(`Delete "${clean(x.t)}"?`, () => deleteTask(x.t))} />
      )}
    </div>
  );
}

export function AddRow({ placeholder, onAdd }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const ref = useRef();
  const go = async () => {
    const v = name.replace(/\s+/g, " ").trim();
    if (!v) return ref.current?.focus();
    setName("");
    setDate("");
    await onAdd(v, date);
  };
  return (
    <div className="b-add">
      <input ref={ref} className="b-input" value={name} placeholder={placeholder} enterKeyHint="done"
        onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(); } }} />
      <input className="b-input b-date" type="date" value={date} aria-label="due date (optional)" onChange={(e) => setDate(e.target.value)} />
      <IconBtn icon="plus" label="Add" onClick={go} />
    </div>
  );
}

// Tasks go to Life/Tasks.md (created if missing) unless another note is picked.
export function useAddTask() {
  const { files, writeFile, processFile } = useApp();
  const { INBOX } = useBoard();
  return async (text, path = INBOX) => {
    try {
      if (!files.has(path)) await writeFile(path, "# Tasks\n\n## Tasks\n");
      await processFile(path, edit.appendUnder("## Tasks", text));
    } catch {}
  };
}

// A task with steps (big task or exam): ring, steps, add a step.
export function StepsBlock({ t, showFile = true }) {
  const { processFile, deleteTask } = useApp();
  const { dueLabel } = useBoard();
  const { confirm } = useDialogs();
  const id = `k-open-${t.path}:${t.line}`;
  const [open, setOpen] = useState(() => store.get(id, "1") === "1");
  const subs = t.children.filter((s) => s.task && clean(s));
  const done = subs.filter((s) => s.completed).length;
  const meta = [showFile ? fileName(t.path) : null, t.due && !t.completed ? dueLabel(t.due) : null].filter(Boolean).join(" · ");
  const toggle = () => { store.set(id, open ? "0" : "1"); setOpen(!open); };
  const finish = () => processFile(t.path, edit.done(t, !t.completed), t.completed ? null : `Finished: ${clean(t)}`);
  return (
    <div className={"b-steps" + (t.completed ? " done" : "")}>
      <div className="b-steps-h">
        <div className={"b-chk" + (t.completed ? " on" : "")} role="checkbox" aria-checked={!!t.completed} tabIndex={0}
          aria-label={t.completed ? "Mark as not finished" : "Mark the whole task finished"} title={t.completed ? "Mark as not finished" : "Mark finished"}
          onClick={(e) => { e.stopPropagation(); finish(); }}
          onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); finish(); } }}>
          {t.completed && <Ico name="check" />}
        </div>
        <Ring value={pct(done, subs.length)} size={46} stroke={5} label={`${done}/${subs.length}`} />
        <div className="b-steps-t" onClick={toggle}>
          <b>{clean(t)}</b>
          {meta && <span>{meta}</span>}
        </div>
        <IconBtn icon="chevron-down" label="Show or hide steps" className={"sm b-toggle" + (open ? "" : " closed")} onClick={toggle} />
        <IconBtn icon="trash-2" label="Delete" className="sm b-del"
          onClick={() => confirm(`Delete "${clean(t)}" and its ${subs.length} step${subs.length === 1 ? "" : "s"}?`, () => deleteTask(t))} />
      </div>
      <div className={"b-steps-b" + (open ? "" : " hidden")}>
        <div className="b-list">
          {subs.map((s) => <TaskRow key={s.line} x={{ t: s, d: s.due }} source={false} del />)}
          {!subs.length && <Empty>No steps yet.</Empty>}
        </div>
        {!t.completed && <AddRow placeholder="Add a step…" onAdd={(name, date) => processFile(t.path, edit.addStep(t, name, date))} />}
      </div>
    </div>
  );
}

export function DueList({ limit = Infinity, onMore }) {
  const { overdue, dueToday, thisWeek } = useBoard();
  const total = overdue.length + dueToday.length + thisWeek.length;
  let shown = 0;
  const groups = [["Overdue", overdue, true], ["Today", dueToday, false], ["Next 7 days", thisWeek, false]].map(([name, list, alert]) => {
    if (!list.length || shown >= limit) return null;
    const part = list.slice(0, limit - shown);
    shown += part.length;
    return (
      <div key={name}>
        <div className={"b-grp" + (alert ? " red" : "")}>{name}</div>
        <div className="b-list">{part.map((x) => <TaskRow key={x.t.path + x.t.line} x={x} />)}</div>
      </div>
    );
  });
  return (
    <>
      {groups}
      {!total && <Empty>Nothing due this week. Enjoy it.</Empty>}
      {total > shown && onMore && <div className="b-more" onClick={onMore}>See all {total} →</div>}
    </>
  );
}

function EventRows({ list }) {
  return (list || []).map((e, i) => (
    <div key={i} className="b-event" style={{ "--hue": e.hw ? "var(--amber)" : "var(--green)" }}>
      <span className="b-event-t">{e.time || "all day"}</span>
      <span>{e.title}</span>
    </div>
  ));
}

/* ---------- home tiles ---------- */

export function Hero({ c = 3 }) {
  const { dash } = useApp();
  const { overdue, dueToday } = useBoard();
  const [now, setNow] = useState(() => M());
  useEffect(() => {
    const t = setInterval(() => setNow(M()), 1000);
    return () => clearInterval(t);
  }, []);
  const h = now.hours();
  const tx = useCardText();
  // The line above the greeting: the card's own (pencil > Change), else the older all-cards setting, else the weekday.
  const item = useCardItem();
  const line = item?.text && "line" in item.text ? item.text.line : dash.mantra;
  const greet = tx(h < 5 ? "late" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 22 ? "evening" : "night");
  return (
    <Tile c={c} m={6} className="b-hero">
      <div className="b-hero-orb">
        <div className="b-hero-orb-d">{now.format("D")}</div>
        <div className="b-hero-orb-m">{now.format("MMM")}</div>
      </div>
      <div>
        <div className="b-eyebrow">{line || now.format("dddd")}</div>
        <div className="b-hero-greet"><Fancy text={greet} /></div>
      </div>
      <div>
        <div className="b-time">{now.format("HH:mm")}<small>{now.format("ss")}</small></div>
        <div className="b-hero-date">{overdue.length ? `${overdue.length} overdue · ` : ""}{dueToday.length} due today</div>
      </div>
    </Tile>
  );
}

export function HomeTasks({ setTab, c = 3, limit = 8 }) {
  const tx = useCardText();
  const { overdue, dueToday, thisWeek, later, single } = useBoard();
  const addTask = useAddTask();
  const undated = single.filter((x) => !x.d);
  const groups = [["Overdue", overdue, true], ["Today", dueToday], ["Next 7 days", thisWeek], ["Later", later], ["No date", undated]];
  const total = groups.reduce((n, [, l]) => n + l.length, 0);
  let left = limit;
  const week = dueToday.length + thisWeek.length;
  return (
    <Tile c={c} m={6} className="b-upnext" title={tx("title")} icon="list-checks" hue="var(--accent)"
      actions={
        <div className="b-row">
          {overdue.length > 0 && <span className="b-chip red">{overdue.length} overdue</span>}
          {week > 0 && <span className="b-chip acc">{week} this week</span>}
        </div>
      }>
      {groups.map(([name, list, alert]) => {
        if (!list.length || left <= 0) return null;
        const part = list.slice(0, left);
        left -= part.length;
        return (
          <div key={name}>
            <div className={"b-grp" + (alert ? " red" : "")}>{name}</div>
            <div className="b-list">{part.map((x) => <TaskRow key={x.t.path + x.t.line} x={x} />)}</div>
          </div>
        );
      })}
      {!total && <Empty>No open tasks. Add one below.</Empty>}
      {total > limit && setTab && <div className="b-more" onClick={() => setTab("tasks")}>See all {total} →</div>}
      <AddRow placeholder="Add a task…" onAdd={(name, d) => addTask(`- [ ] ${name}${dueField(d)}`)} />
    </Tile>
  );
}

export function CalendarTile({ c = 3 }) {
  const { gcal, loadGcal, settings } = useApp();
  const hasCal = (settings.gcal_urls || []).length + (settings.hw_urls || []).length > 0;
  const { today, dailySet, dueSet, calDated, DAILY } = useBoard();
  const { createAndOpen } = useNav();
  const [view, setView] = useState(() => M().startOf("month"));
  const [day, setDay] = useState(() => M().startOf("day"));
  const openDaily = (d) => createAndOpen(DAILY, d.format("YYYY-MM-DD"), "Daily", d.clone());
  const lead = (view.day() + 6) % 7;
  const tasks = calDated.filter((x) => dayKey(x.d) === dayKey(day));
  const evs = gcal.events[dayKey(day)] || [];
  return (
    <Tile c={c} m={6} className="b-calendar" title={view.format("MMMM YYYY")} icon="calendar-days"
      actions={
        <div className="b-row">
          {hasCal && <IconBtn icon="refresh-cw" label="Refresh calendars" className="sm" onClick={() => loadGcal(true)} />}
          <IconBtn icon="chevron-left" label="Previous month" className="sm" onClick={() => setView(view.clone().subtract(1, "month"))} />
          <IconBtn icon="chevron-right" label="Next month" className="sm" onClick={() => setView(view.clone().add(1, "month"))} />
        </div>
      }>
      <div className="b-cal-g">
        {["mo", "tu", "we", "th", "fr", "sa", "su"].map((d) => <div key={d} className="b-dow">{d}</div>)}
        {Array.from({ length: lead }, (_, i) => <div key={"e" + i} className="b-day empty" />)}
        {Array.from({ length: view.daysInMonth() }, (_, i) => {
          const d = view.clone().date(i + 1);
          const key = dayKey(d);
          const has = [dailySet.has(key), dueSet.has(key), !!gcal.events[key]?.length];
          return (
            <div key={key} onClick={() => setDay(d)} onDoubleClick={() => openDaily(d)}
              className={"b-day" + (d.day() % 6 === 0 ? " wknd" : "") + (d.isSame(today, "day") ? " today" : "") + (d.isSame(day, "day") ? " picked" : "")}>
              {i + 1}
              {has.some(Boolean) && (
                <div className="b-dots">
                  {has[0] && <i />}
                  {has[1] && <i className="due" />}
                  {has[2] && <i className="ev" />}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="b-agenda">
        <div className="b-agenda-h">
          <span>{day.isSame(today, "day") ? "Today" : day.format("dddd, D MMM")}</span>
          <Btn variant="ghost" icon="notebook-pen" onClick={() => openDaily(day)}>Daily note</Btn>
        </div>
        {gcal.error && <Empty>{gcal.error}</Empty>}
        <EventRows list={evs} />
        <div className="b-list">{tasks.map((x) => <TaskRow key={x.t.path + x.t.line} x={x} />)}</div>
        {!evs.length && !tasks.length && <Empty>Nothing planned.</Empty>}
      </div>
    </Tile>
  );
}

export function StudyTile({ c = 2, m = 3, setTab }) {
  const tx = useCardText();
  const { studyDone, studyTotal, courses, tabNames } = useBoard();
  const v = pct(studyDone, studyTotal);
  return (
    <Tile c={c} m={m} className="b-sage" title={tx("title")} icon="target" hue="var(--accent)"
      onClick={tabNames.includes("academic") && setTab ? () => setTab("academic") : undefined}>
      <div className="b-study">
        <Ring value={v} size={92} stroke={9} label={Math.round(v * 100) + "%"} className="lg" />
        <div>
          <div className="b-study-n">{studyDone} of {studyTotal} steps</div>
          <div className="b-study-s">{courses.length} courses</div>
        </div>
      </div>
    </Tile>
  );
}

export function LinksTile({ c = 2, m = 3 }) {
  const tx = useCardText();
  const { links } = useBoard();
  const { openPath } = useNav();
  return (
    <Tile c={c} m={m} title={tx("title")} icon="heart" hue="var(--pink)">
      {links.map((l) => (
        <div key={l.name} className="b-link" onClick={() => openPath(l.target)}>
          <Ico name={l.icon} />
          <span>{l.name}</span>
          <Ico name="chevron-right" />
        </div>
      ))}
      {!links.length && <Empty>Add links in settings.</Empty>}
    </Tile>
  );
}

export function HomeworkTile({ c = 6 }) {
  const tx = useCardText();
  const { gcal, settings, saveSetting, loadGcal } = useApp();
  const { today, dueLabel } = useBoard();
  useEffect(() => { if (!settings.hw_since) saveSetting("hw_since", dayKey(today)); }, [settings.hw_since]); // eslint-disable-line
  const since = M(settings.hw_since || dayKey(today));
  const doneSet = new Set(settings.hw_done || []);
  const [showDone, toggleDone] = useFold("hw-done", false);
  const all = Object.entries(gcal.events)
    .flatMap(([k, list]) => list.filter((e) => e.hw).map((e) => ({ ...e, d: M(k), id: `${k}|${e.title}` })))
    .filter((e) => !e.d.isBefore(since, "day"))
    .sort((a, b) => a.d - b.d || (a.time || "").localeCompare(b.time || ""));
  // Finished = ticked and its day has passed. Folded away, not gone.
  const isFinished = (e) => e.d.isBefore(today, "day") && doneSet.has(e.id);
  const finishedCount = all.filter(isFinished).length;
  const items = showDone ? all : all.filter((e) => !isFinished(e));
  const toggle = (id) => {
    doneSet.has(id) ? doneSet.delete(id) : doneSet.add(id);
    saveSetting("hw_done", [...doneSet]);
  };
  return (
    <Tile c={c} m={6} title={tx("title")} icon="book-open" hue="var(--amber)"
      actions={<IconBtn icon="refresh-cw" label="Refresh" className="sm" onClick={() => loadGcal(true)} />}>
      {gcal.error && <Empty>{gcal.error}</Empty>}
      {!items.length && <Empty>{(settings.hw_urls || []).length ? "No homework due." : "Add your school's homework iCal link in settings."}</Empty>}
      <div className="b-list">
        {items.map((e) => {
          const done = doneSet.has(e.id);
          return (
            <div key={e.id} className={"b-task" + (done ? " done" : "")}>
              <div className={"b-chk" + (done ? " on" : "")} role="checkbox" aria-checked={done} aria-label="done" tabIndex={0}
                onClick={() => toggle(e.id)} onKeyDown={(k) => { if (k.key === " " || k.key === "Enter") { k.preventDefault(); toggle(e.id); } }}>
                {done && <Ico name="check" />}
              </div>
              <div className="b-task-m">
                <div className="b-task-t">{e.title}</div>
                <div className="b-task-s">
                  <span className={"b-chip" + (!done && e.d.isBefore(today, "day") ? " red" : "")}>{dueLabel(e.d)}{e.time ? " · " + e.time : ""}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {finishedCount > 0 && (
        <div className="b-more" onClick={toggleDone}>{showDone ? "Hide finished" : `Show ${finishedCount} finished`}</div>
      )}
    </Tile>
  );
}

/* ---------- note cards ---------- */

export function CourseTile({ p, i }) {
  const { study } = useBoard();
  const { openPath } = useNav();
  const s = study.get(p.file.path);
  const next = s.steps.find((x) => !x.completed);
  return (
    <Tile c={2} m={3} className={"b-ntile tint" + (isActive(p) ? "" : " off")} hue={hue(i)} onClick={() => openPath(p.file.path)}>
      <div className="b-ntile-top">
        <span className="b-tag">{isActive(p) ? p.code || "course" : statusOf(p)}</span>
        <Ring value={pct(s.done, s.steps.length)} size={44} stroke={5} />
      </div>
      <div className="b-ntile-t">{p.file.name}</div>
      <div className="b-ntile-s">{next ? "Next: " + clean(next) : s.steps.length ? "All studied" : "No exam steps yet"}</div>
    </Tile>
  );
}

export function ProjectTile({ p, i }) {
  const { openPath } = useNav();
  const tasks = p.file.tasks.filter((x) => clean(x));
  const done = tasks.filter((x) => x.completed).length;
  const dl = p.deadline ? M(String(p.deadline), ["YYYY-MM-DD", M.ISO_8601]) : null;
  return (
    <Tile c={2} m={3} className={"b-ntile tint" + (isActive(p) ? "" : " off")} hue={hue(i + 1)} onClick={() => openPath(p.file.path)}>
      <div className="b-ntile-top">
        <span className="b-tag">{statusOf(p)}</span>
        {p.area && <span className="b-chip">{String(p.area)}</span>}
      </div>
      <div className="b-ntile-t">{p.file.name}</div>
      <Bar value={pct(done, tasks.length)} />
      <div className="b-ntile-s">{dl?.isValid() ? "Due " + dl.format("D MMM") : tasks.length ? `${done} of ${tasks.length} tasks` : "No tasks yet"}</div>
    </Tile>
  );
}

export function OngoingTile({ p, i }) {
  const { openPath } = useNav();
  const s = p.started ? M(String(p.started), ["YYYY-MM-DD", M.ISO_8601]) : null;
  return (
    <Tile c={2} m={3} className={"b-ntile tint" + (isActive(p) ? "" : " off")} hue={hue(i + 3)} onClick={() => openPath(p.file.path)}>
      <div className="b-ntile-top">
        <div className="b-ntile-icon"><Ico name="sparkles" /></div>
        {!isActive(p) && <span className="b-tag">{statusOf(p)}</span>}
      </div>
      <div className="b-ntile-t">{p.file.name}</div>
      <div className="b-ntile-s">{s?.isValid() ? "Since " + s.format("MMM YYYY") : "Ongoing"}</div>
    </Tile>
  );
}

export function LinkTile({ l, i }) {
  const { openPath } = useNav();
  return (
    <Tile c={2} m={3} className="b-ntile tint" hue={hue(i + 2)} onClick={() => openPath(l.target)}>
      <div className="b-ntile-top"><div className="b-ntile-icon"><Ico name={l.icon} /></div></div>
      <div className="b-ntile-t">{l.name}</div>
      <div className="b-ntile-s">{l.target}</div>
    </Tile>
  );
}

export function AddTile({ text, onClick, c = 2, m = 3 }) {
  return (
    <Tile c={c} m={m} className="add" onClick={onClick}>
      <div className="b-row"><Ico name="plus" /><span>{text}</span></div>
    </Tile>
  );
}

// Study tab: a course with its projects, then each exam with its steps.
export function CourseDetail({ p, i }) {
  const { processFile, trashNote } = useApp();
  const { study, byDue } = useBoard();
  const { openPath } = useNav();
  const { ask, confirm } = useDialogs();
  const s = study.get(p.file.path);
  const projs = p.file.tasks.filter((x) => x.parent == null && /^project$/i.test(x.section || ""));
  const exams = s.exams.filter((x) => !x.completed).sort((a, b) => byDue({ d: a.due }, { d: b.due }));
  const finished = s.exams.filter((x) => x.completed);
  return (
    <Tile c={3} m={6} hue={hue(i)} className={isActive(p) ? "" : "b-off"}>
      <div className="b-steps-h">
        <Ring value={pct(s.done, s.steps.length)} size={52} stroke={6} />
        <div className="b-steps-t" onClick={() => openPath(p.file.path)}>
          <b>{p.file.name}</b>
          <span>{isActive(p) ? "" : statusOf(p) + " · "}{s.done} of {s.steps.length} steps studied</span>
        </div>
        <IconBtn icon="trash-2" label="Delete course" className="sm b-del"
          onClick={() => confirm(`Delete the course "${p.file.name}"?`, () => trashNote(p.file.path))} />
      </div>
      {projs.map((x) => <CourseProject key={x.line} x={x} />)}
      <div className="b-row" style={{ marginTop: 12 }}>
        {projs.length < 2 && (
          <Btn icon="plus" onClick={() => processFile(p.file.path, edit.appendUnder("## Project", `- [ ] Project${projs.length ? " " + (projs.length + 1) : ""}`))}>Project</Btn>
        )}
        <Btn icon="plus" onClick={() => ask("New exam", (n) => processFile(p.file.path, edit.appendUnder("## Exams", `- [ ] ${n}`)), "e.g. Midterm")}>Exam</Btn>
      </div>
      {exams.map((x) => <div key={x.line} className="b-exam"><StepsBlock t={x} showFile={false} /></div>)}
      {!exams.length && <Empty>{finished.length ? "No upcoming exams." : "No exams yet."}</Empty>}
      {finished.length > 0 && (
        <FoldGroup id={"exams-done-" + p.file.path} label={`Finished exams · ${finished.length}`}>
          {finished.map((x) => <div key={x.line} className="b-exam"><StepsBlock t={x} showFile={false} /></div>)}
        </FoldGroup>
      )}
    </Tile>
  );
}

function CourseProject({ x }) {
  const { processFile, deleteTask } = useApp();
  const { confirm } = useDialogs();
  const [name, setName] = useState(clean(x));
  useEffect(() => setName(clean(x)), [x.text]); // eslint-disable-line
  const save = () => {
    const v = name.replace(/\s+/g, " ").trim();
    if (!v) setName(clean(x));
    else if (v !== clean(x)) processFile(x.path, edit.rename(x, v));
  };
  return (
    <div className={"b-proj" + (x.completed ? " done" : "")}>
      <div className={"b-chk" + (x.completed ? " on" : "")} role="checkbox" aria-checked={!!x.completed} aria-label="project finished" tabIndex={0}
        onClick={() => processFile(x.path, edit.done(x, !x.completed))}
        onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); processFile(x.path, edit.done(x, !x.completed)); } }}>
        {x.completed && <Ico name="check" />}
      </div>
      <input className="b-proj-t" value={name} onChange={(e) => setName(e.target.value)} onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} aria-label="project name" />
      <input className="b-input" type="date" aria-label="project due date" value={x.due ? x.due.format("YYYY-MM-DD") : ""}
        onChange={(e) => processFile(x.path, edit.due(x, e.target.value))} />
      <IconBtn icon="trash-2" label="Delete project" className="sm b-del"
        onClick={() => confirm(`Delete the project "${clean(x)}"?`, () => deleteTask(x))} />
    </div>
  );
}

export function BigTaskDialog({ close }) {
  const { notice } = useApp();
  const { INBOX, projects, courses } = useBoard();
  const addTask = useAddTask();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [subs, setSubs] = useState("");
  const [where, setWhere] = useState(INBOX);
  const create = async () => {
    const name = title.replace(/\s+/g, " ").trim();
    if (!name) return;
    const lines = [`- [ ] ${name}${dueField(date)}`];
    subs.split("\n").map((s) => s.split("|").map((x) => x.trim())).filter(([n]) => n)
      .forEach(([n, dt]) => lines.push(`\t- [ ] ${n}${dueField(dt)}`));
    close();
    await addTask(lines.join("\n"), where);
    notice("Added " + name);
  };
  return (
    <Modal title="New task with steps" wide onClose={close}>
      <Field label="Task"><input className="b-input" autoFocus value={title} placeholder="e.g. Final project" onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Due date (optional)"><input className="b-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Steps" hint="One per line. Add a date with |  e.g.  Research | 2026-11-20">
        <textarea className="b-textarea" rows={5} value={subs} placeholder={"Research | 2026-11-20\nDraft | 2026-12-01\nPresent"} onChange={(e) => setSubs(e.target.value)} />
      </Field>
      <Field label="Save in">
        <select className="b-input" value={where} onChange={(e) => setWhere(e.target.value)}>
          <option value={INBOX}>Tasks inbox</option>
          {[...projects, ...courses].map((p) => <option key={p.file.path} value={p.file.path}>{p.file.name}</option>)}
        </select>
      </Field>
      <ModalButtons onCancel={close} okText="Create" onOk={create} />
    </Modal>
  );
}
