"use client";
// The dashboard: top bar, page heading, the open tab's items (lib/layout.js), and the dock.
// In Customize mode every item can be dragged, edited, moved to another tab or removed.
import { useEffect, useRef, useState } from "react";
import { M, dueField } from "@/lib/notes";
import { CARDS, SIZES, SIZE_OPTIONS, TEXT_LABELS, defaultHead, getLayout, newId, tabHead, tabList, withLayouts } from "@/lib/layout";
import { flatLook, imgSrc, store } from "@/lib/theme";
import { useApp } from "./AppProvider";
import { BoardCtx, useBoard, useBoardData, useNav } from "./board";
import SearchDialog from "./SearchDialog";
import SettingsDialog from "./SettingsDialog";
import TrashDialog from "./TrashDialog";
import Logo from "./Logo";
import Buddies from "./Buddy";
import SkinBackdrop from "./SkinBackdrop";
import {
  AddTile, BigTaskDialog, CalendarTile, CourseDetail, CourseTile, DueList, Hero, HomeTasks, HomeworkTile, LinkTile,
  LinksTile, OngoingTile, ProjectTile, StepsBlock, StudyTile, TaskRow, hue, useAddTask,
} from "./tiles";
import { TabSelect, WIDGET_TYPES, Widget, WidgetDialog, widgetSpan } from "./widgets";
import { BoxField, Btn, CardItemCtx, Empty, Fancy, FoldGroup, FoldSection, Ico, IconBtn, Modal, Section, Segmented, Tile, useCardText, useDialogs } from "./ui";

export default function Dashboard() {
  const app = useApp();
  const board = useBoardData();
  const [tab, setTabState] = useState(null);
  const [editing, setEditing] = useState(false);

  // The open tab is remembered on this device.
  useEffect(() => {
    const saved = store.get("k-tab", "overview");
    setTabState(board.tabNames.includes(saved) ? saved : board.tabNames[0]);
  }, [board.tabNames]);
  useEffect(() => {
    if (tab == null) return;
    const y = +store.get("k-home-scroll", "0") || 0;
    requestAnimationFrame(() => window.scrollTo(0, y));
    const onScroll = () => store.set("k-home-scroll", String(window.scrollY));
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [tab == null]); // eslint-disable-line

  const setTab = (name) => {
    if (name === tab) return window.scrollTo({ top: 0, behavior: "smooth" });
    store.set("k-tab", name);
    store.set("k-home-scroll", "0");
    setTabState(name);
    window.scrollTo(0, 0);
  };

  // Wallpaper (optional, Settings > Look).
  // (Hyper and Zeus draw their own background, so the wallpaper waits until you switch back.)
  const wall = app.skin ? null : imgSrc(flatLook(app.preview || app.dash).wallpaper);
  useEffect(() => {
    document.body.classList.toggle("b-wall", !!wall);
    document.body.style.backgroundImage = wall ? `url("${wall}")` : "";
    return () => { document.body.classList.remove("b-wall"); document.body.style.backgroundImage = ""; };
  }, [wall]);

  if (tab == null) return null;
  const [title, sub] = tabHead(app.dash, tab);
  const tabs = tabList(app.dash).filter((t) => t.shown);
  const open = (render) => app.openDialog(render);

  const settings = (part) => open((close) => (
    <BoardCtx.Provider value={board}>
      <SettingsDialog close={close} part={part} onCustomize={() => setEditing(true)} />
    </BoardCtx.Provider>
  ));

  return (
    <BoardCtx.Provider value={board}>
      <div className={"b-root b-enter" + (editing ? " b-editing" : "")} key={tab}>
        <div className="b-top">
          <Logo />
          <div className="b-top-m">
            <div className="b-top-t">{app.dash.title && app.dash.title !== "HOME" ? app.dash.title : "Home"}</div>
            <div className="b-top-s">{M().format("dddd, D MMMM")}</div>
          </div>
          <IconBtn icon="search" label="Search notes" onClick={() => open((close) => <SearchDialog close={close} />)} />
          <IconBtn icon={app.dark ? "sun" : "moon"} label={app.dark ? "Light mode" : "Dark mode"} onClick={() => app.setDark(!app.dark)} />
          <IconBtn icon="pencil" label="Customize this page" className={editing ? "on" : ""} onClick={() => setEditing(!editing)} />
          <IconBtn icon="settings-2" label="Settings" onClick={() => settings()} />
        </div>
        {editing && (
          <div className="b-editbar">
            <div>
              <b>Customizing this tab</b>
              <span>Drag <Ico name="grip-vertical" className="inline" /> to move things, tap the pencil to change one, × to take it off. Add widgets, cards or section headings at the end.</span>
            </div>
            <Btn icon="layout-dashboard" onClick={() => settings("home")}>Tabs</Btn>
            <Btn icon="palette" onClick={() => settings("look")}>Look</Btn>
            <Btn variant="primary" icon="check" onClick={() => setEditing(false)}>Done</Btn>
          </div>
        )}
        {editing ? (
          <HeadEditor tab={tab} />
        ) : title && (
          <div className="b-head">
            {sub && <div className="b-eyebrow">{sub}</div>}
            <h1><Fancy text={title} /></h1>
          </div>
        )}
        <TabItems tab={tab} setTab={setTab} editing={editing} startEditing={() => setEditing(true)} />
      </div>
      <SkinBackdrop />
      <Buddies />
      <nav className="b-dock" role="tablist">
        {tabs.map((t) => (
          <div key={t.id} className={"b-dock-i" + (t.id === tab ? " on" : "")} role="tab" aria-selected={t.id === tab}
            aria-label={t.name} title={t.name} onClick={() => setTab(t.id)}>
            <Ico name={t.icon} />
            <span className="b-dock-l">{t.name}</span>
          </div>
        ))}
      </nav>
    </BoardCtx.Provider>
  );
}

/* ---------- a tab's items, and customizing them ---------- */

// While customizing: the tab's page heading and the small line above it, as text boxes.
// Saved in tab_info[tab].head / .sub; empty brings back the default.
function HeadEditor({ tab }) {
  const app = useApp();
  const info = app.dash.tab_info?.[tab] || {};
  const [def, defSub] = defaultHead(app.dash, tab);
  const [head, setHead] = useState(info.head || "");
  const [sub, setSub] = useState(info.sub || "");
  const save = () => {
    const h = head.trim(), s = sub.trim();
    if (h === (info.head || "") && s === (info.sub || "")) return;
    const meta = tabList(app.dash).find((t) => t.id === tab);
    const next = { ...(app.dash.tab_info?.[tab] || { name: meta?.name, icon: meta?.icon }), head: h || undefined, sub: s || undefined };
    Object.keys(next).forEach((k) => next[k] === undefined && delete next[k]);
    app.saveSetting("dashboard", { ...app.dash, tab_info: { ...(app.dash.tab_info || {}), [tab]: next } });
  };
  return (
    <div className="b-head b-head-edit">
      <input className="b-input" value={sub} maxLength={80} placeholder={defSub ? `Line above: ${defSub}` : "Line above the heading (optional)"}
        aria-label="Line above the heading" onChange={(e) => setSub(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
      <input className="b-input big" value={head} maxLength={40} placeholder={def ? `Heading: ${def}` : "Heading (optional)"}
        aria-label="Page heading" onChange={(e) => setHead(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
      <small className="b-hint">Empty keeps the default. Put *stars* around a word to style it.</small>
    </div>
  );
}

const moveIn = (list, from, to) => {
  const next = [...list];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
};
const itemName = (it) => (it.card ? CARDS[it.card].name : it.type === "heading" ? `"${(it.title || "Section").replace(/\*/g, "")}"` : WIDGET_TYPES[it.type]?.[1] || "Widget");

function TabItems({ tab, setTab, editing, startEditing }) {
  const app = useApp();
  const board = useBoard();
  const items = getLayout(app.dash, tab);
  const tabs = tabList(app.dash);
  const tabName = (id) => tabs.find((t) => t.id === id)?.name || id;

  // Saves new layouts; `undo` is the toast text for a change that can be taken back.
  const save = (patch, undo) => {
    const before = app.dash;
    app.saveSetting("dashboard", withLayouts(app.dash, patch));
    if (undo) app.notice(undo, { label: "Undo", run: () => app.saveSetting("dashboard", before) });
  };
  const setItems = (list, undo) => save({ [tab]: list }, undo);
  const remove = (idx) => setItems(items.filter((_, j) => j !== idx), `Removed ${itemName(items[idx])} from this tab`);
  // Replace an item, or send it to another tab (it goes at the end there).
  const put = (idx, it, to = tab) => {
    const clean = { ...it, id: it.id || newId() };
    delete clean.tab;
    if (to === tab) return setItems(idx == null ? [...items, clean] : items.map((x, j) => (j === idx ? clean : x)));
    save({ [tab]: idx == null ? items : items.filter((_, j) => j !== idx), [to]: [...getLayout(app.dash, to), clean] },
      `Moved ${itemName(clean)} to ${tabName(to)}`);
  };

  const editItem = (idx) => {
    const it = items[idx];
    if (it.card) return app.openDialog((close) => <CardDialog close={close} it={it} tab={tab} onSave={(x, to) => put(idx, x, to)} onRemove={() => remove(idx)} />);
    app.openDialog((close) => (
      <BoardCtx.Provider value={board}>
        <WidgetDialog close={close} initial={{ ...it, tab }} onSave={(w) => put(idx, w, w.tab || tab)} onDelete={() => remove(idx)} />
      </BoardCtx.Provider>
    ));
  };
  const add = () => app.openDialog((close) => (
    <AddDialog close={close} tab={tab} items={items} tabName={tabName(tab)}
      onCard={(card) => { put(null, { card }); app.notice(`Added ${CARDS[card].name}`); }}
      onWidget={(type) => app.openDialog((c2) => (
        <BoardCtx.Provider value={board}>
          <WidgetDialog close={c2} initial={{ type, tab }} onSave={(w) => put(null, w, w.tab || tab)} />
        </BoardCtx.Provider>
      ))} />
  ));

  // Drag to reorder: hold the grip, move over another item, let go.
  const [drag, setDrag] = useState(null); // { from, over }
  const dragRef = useRef(null);
  const grip = (idx) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      dragRef.current = { from: idx, over: idx };
      setDrag(dragRef.current);
    },
    onPointerMove: (e) => {
      if (!dragRef.current) return;
      if (e.clientY < 70) window.scrollBy(0, -14);
      else if (e.clientY > window.innerHeight - 120) window.scrollBy(0, 14);
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-idx]");
      if (el && +el.dataset.idx !== dragRef.current.over) {
        dragRef.current = { ...dragRef.current, over: +el.dataset.idx };
        setDrag(dragRef.current);
      }
    },
    onPointerUp: () => {
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (d && d.from !== d.over) setItems(moveIn(items, d.from, d.over));
    },
    onPointerCancel: () => { dragRef.current = null; setDrag(null); },
  });

  return (
    <div className="b-grid">
      {items.map((it, idx) => {
        const tools = editing && (
          <div className="b-wtools" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="b-icon-btn sm b-grip" aria-label="Drag to move" title="Drag to move" {...grip(idx)}>
              <Ico name="grip-vertical" />
            </button>
            <IconBtn icon="chevron-left" label="Move earlier" className="sm" onClick={() => idx > 0 && setItems(moveIn(items, idx, idx - 1))} />
            <IconBtn icon="chevron-right" label="Move later" className="sm" onClick={() => idx < items.length - 1 && setItems(moveIn(items, idx, idx + 1))} />
            <IconBtn icon="pencil" label="Change" className="sm" onClick={() => editItem(idx)} />
            <IconBtn icon="x" label="Take off this tab" className="sm" onClick={() => remove(idx)} />
          </div>
        );
        const cls = drag ? (drag.from === idx ? " dragging" : drag.over === idx ? (drag.over < drag.from ? " drop-before" : " drop-after") : "") : "";
        return <Item key={it.id || idx} it={it} idx={idx} tab={tab} setTab={setTab} tools={tools} cls={cls} />;
      })}
      {!items.length && !editing && (
        <Tile c={6} m={6} className="add" onClick={startEditing}>
          <div className="b-row"><Ico name="pencil" /><span>This tab is empty. Tap here to add widgets, cards or section headings.</span></div>
        </Tile>
      )}
      {editing && (
        <Tile c={2} m={6} className="add" onClick={add}>
          <div className="b-row"><Ico name="plus" /><span>Add to this tab</span></div>
        </Tile>
      )}
    </div>
  );
}

function Item({ it, idx, tab, setTab, tools, cls }) {
  let span, body, kind = "";
  if (it.card) {
    const meta = CARDS[it.card];
    const View = CARD_VIEWS[it.card];
    if (meta.section) {
      span = [6, 6];
      kind = " sec";
      body = <div className="b-grid b-sub"><CardItemCtx.Provider value={it}><View tab={tab} setTab={setTab} /></CardItemCtx.Provider></div>;
    } else {
      span = SIZES[it.size]?.slice(0, 2) || meta.span;
      body = <CardItemCtx.Provider value={it}><View tab={tab} setTab={setTab} /></CardItemCtx.Provider>;
    }
  } else if (it.type === "heading") {
    span = [6, 6];
    kind = " sec";
    body = <Section title={it.title || "Section"} />;
  } else {
    span = widgetSpan(it);
    if (it.type === "picture") kind = (it.shape || "original") === "original" ? " pic-free" : "";
    body = <Widget w={it} i={idx} />;
  }
  // The card's own box color: glass, clear, a named color or any color.
  const box = it.box || "";
  const named = box && !box.startsWith("#") && box !== "glass" && box !== "clear";
  const boxProps = !box ? {} : {
    "data-box": box === "glass" || box === "clear" ? box : "color",
    style: box.startsWith("#") ? { "--box": box } : named ? { "--box": box === "accent" ? "var(--accent)" : `var(--${box})` } : undefined,
  };
  return (
    <div className={`b-item c${span[0]} m${span[1]}${kind}${cls}`} data-idx={idx} {...boxProps}>
      {tools}
      {body}
    </div>
  );
}

// Built-in card: width and which tab it's on.
function CardDialog({ close, it, tab, onSave, onRemove }) {
  const { dash } = useApp();
  const meta = CARDS[it.card];
  const [size, setSize] = useState(it.size || "");
  const [box, setBox] = useState(it.box || "");
  const [to, setTo] = useState(tab);
  const [text, setText] = useState(() => ({ ...(it.card === "hero" && !("line" in (it.text || {})) ? { line: dash.mantra || "" } : {}), ...(it.text || {}) }));
  const ok = () => {
    const next = { ...it };
    if (size) next.size = size; else delete next.size;
    if (box) next.box = box; else delete next.box;
    const own = Object.fromEntries(Object.entries(text).map(([k, v]) => [k, String(v || "").trim()]).filter(([k, v]) => (k === "line" ? true : v && v !== meta.text?.[k])));
    if (Object.keys(own).length) next.text = own; else delete next.text;
    close();
    onSave(next, to);
  };
  return (
    <Modal title={meta.name} onClose={close}>
      {!meta.section && (
        <div className="b-field">
          <span>Width</span>
          <Segmented value={size} options={{ "": "Auto", ...SIZE_OPTIONS }} onChange={setSize} />
        </div>
      )}
      {Object.entries(meta.text || {}).map(([k, def]) => (
        <div className="b-field" key={k}>
          <span>{TEXT_LABELS[k] || k}</span>
          <input className="b-input" value={text[k] ?? ""} placeholder={def || (k === "line" ? "Empty shows the day of the week" : "")} maxLength={80} onChange={(e) => setText({ ...text, [k]: e.target.value })} />
        </div>
      ))}
      {meta.text && <small className="b-hint">Empty keeps the default. Put *stars* around a word to style it.</small>}
      <BoxField value={box} onChange={setBox} />
      <TabSelect tabs={tabList(dash)} value={to} onChange={(e) => setTo(e.target.value)} />
      <div className="b-modal-btns">
        <Btn variant="danger" icon="x" onClick={() => { close(); onRemove(); }}>Take off this tab</Btn>
        <span style={{ flex: 1 }} />
        <Btn onClick={close}>Cancel</Btn>
        <Btn variant="primary" onClick={ok}>Save</Btn>
      </div>
    </Modal>
  );
}

// Everything that can go on a tab.
function AddDialog({ close, tab, items, tabName, onCard, onWidget }) {
  const here = new Set(items.filter((x) => x.card).map((x) => x.card));
  return (
    <Modal title={`Add to ${tabName}`} wide onClose={close}>
      <div className="b-msec">Your own</div>
      <div className="b-wtypes">
        {Object.entries(WIDGET_TYPES).map(([k, [icon, label]]) => (
          <button key={k} type="button" className="b-wtype" onClick={() => { close(); onWidget(k); }}>
            <Ico name={icon} /><span>{label}</span>
          </button>
        ))}
      </div>
      <div className="b-msec">Built-in cards</div>
      <div className="b-wtypes">
        {Object.entries(CARDS).map(([k, c]) => (
          <button key={k} type="button" className="b-wtype" onClick={() => { close(); onCard(k); }}>
            <Ico name={c.icon} />
            <span>{c.name}{here.has(k) && <small className="b-wtype-s">already on this tab</small>}</span>
          </button>
        ))}
      </div>
      <small className="b-hint">Everything here can also go on any other tab{tab === "overview" ? "" : ", including Home"}.</small>
      <div className="b-modal-btns"><Btn onClick={close}>Close</Btn></div>
    </Modal>
  );
}

/* ---------- built-in cards ---------- */

function useMakers() {
  const board = useBoard();
  const { ACADEMIC, PROJECTS, ONGOING } = board;
  const { createAndOpen } = useNav();
  const { ask } = useDialogs();
  const { openDialog } = useApp();
  return {
    newCourse: () => ask("New course", (n) => createAndOpen(ACADEMIC, n, "Course")),
    newProject: () => ask("New project", (n) => createAndOpen(PROJECTS, n, "Project")),
    newOngoing: () => ask("New ongoing thing (e.g. Investment)", (n) => createAndOpen(ONGOING, n, "Ongoing")),
    newBigTask: () => openDialog((close) => <BoardCtx.Provider value={board}><BigTaskDialog close={close} /></BoardCtx.Provider>),
  };
}

// Notes that aren't active (status done, paused, archived…), in their own folding section.
// Folded on Home, open elsewhere. Change the status at the top of the note.
function OffSection({ id, title, list, Tile: T, open = false }) {
  if (!list.length) return null;
  return (
    <FoldSection id={id} title={title} count={list.length} openByDefault={open}>
      {list.map((p, i) => <T key={p.file.path} p={p} i={i} />)}
    </FoldSection>
  );
}

function CoursesCard({ tab }) {
  const tx = useCardText();
  const { courses, coursesOff } = useBoard();
  const mk = useMakers();
  return (
    <>
      <Section title={tx("title")} count={courses.length}><Btn icon="plus" onClick={mk.newCourse}>Course</Btn></Section>
      {courses.map((p, i) => <CourseTile key={p.file.path} p={p} i={i} />)}
      {!courses.length && <AddTile text="New course" onClick={mk.newCourse} />}
      <OffSection id={tab + "-courses-off"} title={tx("off")} list={coursesOff} Tile={CourseTile} />
    </>
  );
}

function CourseDetailCard({ tab }) {
  const tx = useCardText();
  const { courses, coursesOff } = useBoard();
  const mk = useMakers();
  return (
    <>
      <Section title={tx("title")} count={courses.length}><Btn icon="plus" onClick={mk.newCourse}>Course</Btn></Section>
      {courses.map((p, i) => <CourseDetail key={p.file.path} p={p} i={i} />)}
      {!courses.length && <AddTile text="New course" onClick={mk.newCourse} c={3} m={6} />}
      <OffSection id={(tab === "academic" ? "study" : tab) + "-courses-off"} title={tx("off")} list={coursesOff} Tile={CourseDetail} />
    </>
  );
}

function ProjectsCard({ tab }) {
  const tx = useCardText();
  const { projects, projectsOff } = useBoard();
  const mk = useMakers();
  return (
    <>
      <Section title={tx("title")} count={projects.length}><Btn icon="plus" onClick={mk.newProject}>Project</Btn></Section>
      {projects.map((p, i) => <ProjectTile key={p.file.path} p={p} i={i} />)}
      {!projects.length && <AddTile text="New project" onClick={mk.newProject} />}
      <OffSection id={(tab === "overview" ? "home" : tab) + "-projects-off"} title={tx("off")} list={projectsOff}
        Tile={ProjectTile} open={tab !== "overview"} />
    </>
  );
}

function OngoingCard({ tab }) {
  const tx = useCardText();
  const { ongoing, ongoingOff } = useBoard();
  const mk = useMakers();
  return (
    <>
      <Section title={tx("title")} count={ongoing.length}><Btn icon="plus" onClick={mk.newOngoing}>Ongoing</Btn></Section>
      {ongoing.map((p, i) => <OngoingTile key={p.file.path} p={p} i={i} />)}
      {!ongoing.length && <AddTile text="New ongoing" onClick={mk.newOngoing} />}
      <OffSection id={(tab === "overview" ? "home" : tab) + "-ongoing-off"} title={tx("off")} list={ongoingOff}
        Tile={OngoingTile} open={tab !== "overview"} />
    </>
  );
}

function LifeLinksCard() {
  const tx = useCardText();
  const { links } = useBoard();
  return (
    <>
      <Section title={tx("title")} />
      {links.map((l, i) => <LinkTile key={l.name} l={l} i={i} />)}
      {!links.length && <Tile c={6} m={6}><Empty>Add links in Settings &gt; Home.</Empty></Tile>}
    </>
  );
}

// One list of every task, grouped by when it's due.
function AllTasksCard() {
  const tx = useCardText();
  const b = useBoard();
  const mk = useMakers();
  const addTask = useAddTask();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const add = async () => {
    const v = name.replace(/\s+/g, " ").trim();
    if (!v) return;
    setName("");
    setDate("");
    await addTask(`- [ ] ${v}${dueField(date)}`);
  };
  const undated = b.single.filter((x) => !x.d).sort((a, c) => a.t.path.localeCompare(c.t.path) || a.t.line - c.t.line);
  return (
    <Tile c={6} m={6} title={tx("title")} icon="list-checks" hue="var(--accent)">
      <div className="b-quick">
        <input className="b-input" value={name} placeholder="What needs doing?" enterKeyHint="done"
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <input className="b-input b-date" type="date" value={date} aria-label="due date (optional)" onChange={(e) => setDate(e.target.value)} />
        <Btn variant="primary" icon="plus" onClick={add}>Add</Btn>
        <Btn icon="layers" onClick={mk.newBigTask}>With steps</Btn>
      </div>
      <div className="b-cols">
        <div><DueList /></div>
        <div>
          {b.later.length > 0 && (
            <>
              <div className="b-grp">Later</div>
              <div className="b-list">{b.later.map((x) => <TaskRow key={x.t.path + x.t.line} x={x} del />)}</div>
            </>
          )}
          {undated.length > 0 && (
            <>
              <div className="b-grp">No date</div>
              <div className="b-list">{undated.map((x) => <TaskRow key={x.t.path + x.t.line} x={x} del />)}</div>
            </>
          )}
          {b.doneSingle.length > 0 && (
            <FoldGroup id="tasks-done" label={`Done · ${b.doneSingle.length}`}>
              <div className="b-list">{b.doneSingle.map((x) => <TaskRow key={x.t.path + x.t.line} x={x} del />)}</div>
            </FoldGroup>
          )}
        </div>
      </div>
    </Tile>
  );
}

function BigTasksCard() {
  const tx = useCardText();
  const { bigTasks } = useBoard();
  const mk = useMakers();
  return (
    <>
      <Section title={tx("title")} count={bigTasks.length}><Btn icon="plus" onClick={mk.newBigTask}>New</Btn></Section>
      {bigTasks.map((t, i) => (
        <Tile key={t.path + t.line} c={3} m={6} hue={hue(i)}><StepsBlock t={t} /></Tile>
      ))}
      {!bigTasks.length && <AddTile text="New task with steps" onClick={mk.newBigTask} c={3} m={6} />}
    </>
  );
}

function RecentCard() {
  const tx = useCardText();
  const { notTpl } = useBoard();
  const { openPath } = useNav();
  const app = useApp();
  const trashed = [...app.files.keys()].filter((p) => p.startsWith(".trash/")).length;
  const [since, setSince] = useState(() => +store.get("k-recent-since", "0") || 0);
  const list = notTpl.filter((p) => p.file.mtime > since).sort((a, b) => b.file.mtime - a.file.mtime).slice(0, 30);
  return (
    <Tile c={6} m={6} title={tx("title")} icon="history"
      actions={
        <div className="b-row">
          {since > 0 && <Btn variant="ghost" onClick={() => { store.set("k-recent-since", "0"); setSince(0); }}>Show all</Btn>}
          <Btn variant="ghost" onClick={() => { const n = Date.now(); store.set("k-recent-since", String(n)); setSince(n); }}>Clear list</Btn>
        </div>
      }>
      {list.map((p) => (
        <div key={p.file.path} className="b-result" onClick={() => openPath(p.file.path)}>
          <Ico name="file-text" />
          <div>
            <div className="b-result-t">{p.file.name}</div>
            <div className="b-result-s">{p.file.folder || "notes"}</div>
          </div>
          <span className="b-chip">{M(p.file.mtime).fromNow(true)}</span>
        </div>
      ))}
      {!list.length && <Empty>Nothing edited since the list was cleared. Your notes are untouched.</Empty>}
      <div className="b-more" onClick={() => app.openDialog((close) => <TrashDialog close={close} />)}>
        Trash · {trashed} deleted note{trashed === 1 ? "" : "s"} →
      </div>
    </Tile>
  );
}

const CARD_VIEWS = {
  hero: () => <Hero />,
  links: () => <LinksTile />,
  upnext: ({ setTab }) => <HomeTasks setTab={setTab} />,
  calendar: () => <CalendarTile />,
  study: ({ setTab }) => <StudyTile setTab={setTab} />,
  homework: () => <HomeworkTile />,
  alltasks: AllTasksCard,
  recent: RecentCard,
  courses: CoursesCard,
  coursedetail: CourseDetailCard,
  projects: ProjectsCard,
  ongoing: OngoingCard,
  bigtasks: BigTasksCard,
  lifelinks: LifeLinksCard,
};
