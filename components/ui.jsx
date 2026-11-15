"use client";
// Small building blocks shared by every screen.
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, BookOpen, Bookmark, Brain, Briefcase, Calendar, CalendarDays, Camera, Car, ChartLine, Check,
  ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock, Code, Coffee, CreditCard, Database, Download,
  Dumbbell, FileText, Film, Flag, Flame, FolderKanban, Gamepad2, Globe, GraduationCap, Heart, History, Hourglass,
  House, Image, Inbox, Landmark, Layers, LayoutDashboard, Lightbulb, Link, ListChecks, LogOut, Mail, Moon, Music,
  NotebookPen, Pencil, PiggyBank, Plane, Plus, Quote, RefreshCw, Rocket, Search, Settings2, ShoppingCart, Sparkles,
  Star, Sun, Target, Trash2, TriangleAlert, Trophy, User, Utensils, Wallet,
  ArrowDown, ArrowUp, Cat, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Crown, Dog,
  EyeOff, Feather, GripVertical, Monitor, Smartphone, Flower2, Gem, Leaf, Mountain, Palette, PawPrint, StickyNote, Upload, X, Zap,
} from "lucide-react";
import { store } from "@/lib/theme";
import { cardText } from "@/lib/layout";
import { useApp } from "./AppProvider";

// Names usable in settings ("Money Map | Life/Money Map | wallet").
export const ICONS = {
  "arrow-left": ArrowLeft, "book-open": BookOpen, book: BookOpen, bookmark: Bookmark, brain: Brain, briefcase: Briefcase,
  calendar: Calendar, "calendar-days": CalendarDays, camera: Camera, car: Car, "chart-line": ChartLine, check: Check,
  "chevron-down": ChevronDown, "chevron-left": ChevronLeft, "chevron-right": ChevronRight, "clipboard-list": ClipboardList,
  clock: Clock, code: Code, coffee: Coffee, "credit-card": CreditCard, database: Database, download: Download,
  dumbbell: Dumbbell, "file-text": FileText, film: Film, flag: Flag, flame: Flame, "folder-kanban": FolderKanban,
  "gamepad-2": Gamepad2, globe: Globe, "graduation-cap": GraduationCap, heart: Heart, history: History,
  hourglass: Hourglass, house: House, home: House, image: Image, inbox: Inbox, landmark: Landmark, layers: Layers,
  "layout-dashboard": LayoutDashboard, lightbulb: Lightbulb, link: Link, "list-checks": ListChecks, "log-out": LogOut,
  mail: Mail, moon: Moon, music: Music, "notebook-pen": NotebookPen, pencil: Pencil, "piggy-bank": PiggyBank,
  plane: Plane, plus: Plus, quote: Quote, "refresh-cw": RefreshCw, rocket: Rocket, search: Search,
  "settings-2": Settings2, "shopping-cart": ShoppingCart, sparkles: Sparkles, star: Star, sun: Sun, target: Target,
  "trash-2": Trash2, "triangle-alert": TriangleAlert, trophy: Trophy, user: User, utensils: Utensils, wallet: Wallet,
  "arrow-down": ArrowDown, "arrow-up": ArrowUp, cat: Cat, cloud: Cloud, "cloud-drizzle": CloudDrizzle, "cloud-fog": CloudFog,
  "cloud-lightning": CloudLightning, "cloud-rain": CloudRain, "cloud-snow": CloudSnow, "cloud-sun": CloudSun, crown: Crown,
  dog: Dog, "eye-off": EyeOff, "grip-vertical": GripVertical, monitor: Monitor, smartphone: Smartphone, feather: Feather, flower: Flower2, gem: Gem, leaf: Leaf, mountain: Mountain, palette: Palette,
  paw: PawPrint, "sticky-note": StickyNote, upload: Upload, x: X, zap: Zap,
};
// Icons offered for the logo (Settings > Look).
export const LOGO_ICONS = [
  "house", "star", "sparkles", "heart", "flower", "leaf", "mountain", "sun", "moon", "zap", "rocket", "crown",
  "gem", "feather", "cat", "dog", "paw", "coffee", "music", "book-open", "graduation-cap", "brain", "target", "flame",
];

export function Icon({ name, ...rest }) {
  const C = ICONS[name] || Link;
  return <C aria-hidden="true" {...rest} />;
}
export const Ico = ({ name, className = "" }) => (
  <span className={"b-ico " + className}><Icon name={name} /></span>
);

export function IconBtn({ icon, label, onClick, className = "" }) {
  return (
    <button type="button" className={"b-icon-btn " + className} aria-label={label} title={label}
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}>
      <Icon name={icon} />
    </button>
  );
}

export function Btn({ children, icon, onClick, variant = "", type = "button", disabled, style }) {
  return (
    <button type={type} className={"b-btn " + variant} disabled={disabled} style={style}
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}>
      {icon && <Ico name={icon} />}
      {children}
    </button>
  );
}

// "Your *courses*": the starred word gets the italic accent style.
export function Fancy({ text }) {
  return String(text).split(/(\*[^*]+\*)/).map((part, i) =>
    /^\*.+\*$/.test(part) ? <em key={i}>{part.slice(1, -1)}</em> : part
  );
}

// A tile in the bento grid. c = desktop columns (of 6), m = phone columns (of 6).
export function Tile({ c = 2, m = 6, className = "", hue, title, icon, actions, onClick, children, style }) {
  return (
    <div className={`b-tile c${c} m${m} ${className}${onClick ? " click" : ""}`}
      style={{ ...(hue ? { "--hue": hue } : {}), ...style }} onClick={onClick}>
      {title != null && (
        <div className="b-th">
          {icon && <Ico name={icon} />}
          <div className="b-th-t">{typeof title === "string" ? <Fancy text={title} /> : title}</div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

// The layout item a built-in card is drawn for, so the card can show its own texts.
export const CardItemCtx = createContext(null);
export const useCardItem = () => useContext(CardItemCtx);
export const useCardText = () => { const it = useContext(CardItemCtx); return (key) => cardText(it, key); };

export function Section({ title, count, children }) {
  return (
    <div className="b-sec">
      <h2><Fancy text={title} />{count != null && <small>{count}</small>}</h2>
      <div className="b-row">{children}</div>
    </div>
  );
}

// Open/closed state of a folding section, remembered on this device.
export function useFold(id, openByDefault = true) {
  const key = "k-fold-" + id;
  const [open, setOpen] = useState(() => store.get(key, openByDefault ? "1" : "0") === "1");
  return [open, () => { store.set(key, open ? "0" : "1"); setOpen(!open); }];
}

// A section title that folds the cards after it: <FoldSection id title count>{tiles}</FoldSection>
export function FoldSection({ id, title, count, openByDefault = true, actions, children }) {
  const [open, toggle] = useFold(id, openByDefault);
  return (
    <>
      <div className={"b-sec fold" + (open ? "" : " closed")}>
          <h2 role="button" tabIndex={0} aria-expanded={open} onClick={toggle}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle())}>
          <Ico name="chevron-down" /><Fancy text={title} />{count != null && <small>{count}</small>}
        </h2>
        <div className="b-row">{actions}</div>
      </div>
      {open && children}
    </>
  );
}

// A small folding group inside a card ("Done 12 ▾").
export function FoldGroup({ id, label, openByDefault = false, children }) {
  const [open, toggle] = useFold(id, openByDefault);
  return (
    <>
      <div className={"b-grp fold" + (open ? "" : " closed")} role="button" tabIndex={0} aria-expanded={open} onClick={toggle}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle())}>
        <Ico name="chevron-down" />{label}
      </div>
      {open && children}
    </>
  );
}

export function Ring({ value, size = 52, stroke = 6, label, className = "" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const h = size / 2;
  return (
    <div className={"b-ring " + className} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle className="b-ring-track" cx={h} cy={h} r={r} strokeWidth={stroke} />
        <circle className="b-ring-bar" cx={h} cy={h} r={r} strokeWidth={stroke} strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, value || 0))} transform={`rotate(-90 ${h} ${h})`} />
      </svg>
      <div className="b-ring-t">{label ?? Math.round((value || 0) * 100) + "%"}</div>
    </div>
  );
}

export const Bar = ({ value }) => (
  <div className="b-bar"><i style={{ width: Math.round(Math.min(1, value || 0) * 100) + "%" }} /></div>
);
export const Empty = ({ children }) => <div className="b-empty">{children}</div>;

// A card's own box color (Customize > Change): theme default, glass, clear, a color, or any color.
export const BOX_COLORS = { "": "Theme", glass: "Glass", clear: "Clear", accent: "Accent", blue: "Blue", green: "Green", amber: "Amber", pink: "Pink", violet: "Violet", red: "Red" };
export function BoxField({ value = "", onChange }) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : "";
  return (
    <div className="b-field">
      <span>Box color</span>
      <Segmented value={hex ? "custom" : value} options={{ ...BOX_COLORS, custom: "Pick…" }}
        onChange={(v) => onChange(v === "custom" ? hex || "#7c5cff" : v)} />
      {hex !== "" && <input type="color" className="b-box-pick" value={hex} onChange={(e) => onChange(e.target.value)} aria-label="Box color" />}
      <small>Clear has no box at all; Glass lets the background show through.</small>
    </div>
  );
}

// A row of buttons where one is picked: <Segmented value={v} options={{ a: "A", b: "B" }} onChange={setV} />
export function Segmented({ value, options, onChange }) {
  return (
    <div className="b-seg" role="radiogroup">
      {Object.entries(options).map(([k, label]) => (
        <button key={k} type="button" role="radio" aria-checked={k === value} className={k === value ? "on" : ""} data-mode={k}
          onClick={() => onChange(k)}>{label}</button>
      ))}
    </div>
  );
}

export function Modal({ title, wide, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="b-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={"b-modal" + (wide ? " wide" : "")} role="dialog" aria-label={title}>
        <h3 className="b-modal-t">{title}</h3>
        {children}
      </div>
    </div>
  );
}
export const ModalButtons = ({ onCancel, okText, onOk }) => (
  <div className="b-modal-btns">
    <Btn onClick={onCancel}>Cancel</Btn>
    <Btn variant="primary" onClick={onOk}>{okText}</Btn>
  </div>
);
export function Field({ label, hint, children }) {
  return (
    <div className="b-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}

function AskDialog({ title, placeholder, okText, onOk, close }) {
  const [v, setV] = useState("");
  const ref = useRef();
  useEffect(() => { setTimeout(() => ref.current?.focus(), 50); }, []);
  const submit = () => {
    const name = String(v).replace(/[\\/:*?"<>|#^\[\]]/g, "").trim();
    if (name) { close(); onOk(name); }
  };
  return (
    <Modal title={title} onClose={close}>
      <input ref={ref} className="b-input" value={v} placeholder={placeholder} enterKeyHint="done"
        onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      <ModalButtons onCancel={close} okText={okText} onOk={submit} />
    </Modal>
  );
}

// Dialog helpers: ask("New course", name => ...), confirm("Delete X?", () => ...)
export function useDialogs() {
  const { openDialog } = useApp();
  return {
    ask: (title, onOk, placeholder = "Name", okText = "Create") =>
      openDialog((close) => <AskDialog title={title} placeholder={placeholder} okText={okText} onOk={onOk} close={close} />),
    confirm: (title, onOk, okText = "Delete") =>
      openDialog((close) => (
        <Modal title={title} onClose={close}>
          <ModalButtons onCancel={close} okText={okText} onOk={async () => { close(); await onOk(); }} />
        </Modal>
      )),
  };
}
