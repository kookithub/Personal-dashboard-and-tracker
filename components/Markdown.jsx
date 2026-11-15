"use client";
// Shows a note's Markdown. Task checkboxes can be ticked, [[links]] open notes,
// and a daily note's "due today" block lists the tasks due that day.
import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { M, TPL, clean, dayKey, edit, fileName, noteHref, parseFrontmatter } from "@/lib/notes";
import { useApp } from "./AppProvider";
import { Empty } from "./ui";

const DUE = "%%DUE%%";
// Notes may contain HTML. It is cleaned before it is shown, so a script or event handler
// hidden in a pasted or imported note can't run (safe HTML such as <details> or <img> stays).
const safeHtml = (md) => (DOMPurify.isSupported ? DOMPurify.sanitize(marked.parse(md, { gfm: true })) : "");

export default function Markdown({ path, interactive = true }) {
  const { files, pages, resolve, processFile } = useApp();
  const router = useRouter();
  const ref = useRef();
  const text = files.get(path)?.content ?? "";
  const isDaily = /(^|\/)Daily\/\d{4}-\d{2}-\d{2}\.md$/.test(path);

  const { parts, taskLines } = useMemo(() => {
    const lines = text.split("\n");
    const { lines: skip } = parseFrontmatter(text);
    let body = lines.slice(skip).join("\n");
    body = body.replace(/```dataview(js)?\s*\n[\s\S]*?```/g, (m) => (isDaily && /this\.file\.day/.test(m) ? `\n${DUE}\n` : ""));
    body = body.replace(/(!?)\[\[([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, emb, target, _h, alias) =>
      `[${alias || target}](${noteHref(resolve(target) || target.trim() + ".md")})`);
    body = body.replace(/%%(?!DUE%%)[\s\S]*?%%/g, ""); // Obsidian comments
    // Inline fields ([due:: 2026-11-15], [priority:: high]) show as small labels instead of raw text.
    body = body.replace(/\[([\w-]+)::\s*([^\]\n]*)\]/g, (_, k, v) => {
      const day = /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? M(v.trim()) : null;
      const text = k === "due" && day ? "📅 " + day.format(day.year() === M().year() ? "D MMM" : "D MMM YYYY") : `${k}: ${v.trim()}`;
      return `<span class="b-md-field">${text.replace(/[<>&]/g, "")}</span>`;
    });
    const parts = body.split(DUE).map(safeHtml);
    const taskLines = [];
    let fence = false;
    for (let i = skip; i < lines.length; i++) {
      if (/^\s*(```|~~~)/.test(lines[i])) { fence = !fence; continue; }
      if (!fence && /^\s*(?:[-*+]|\d+[.)]) \[[ xX]\]\s+\S/.test(lines[i])) taskLines.push(i);
    }
    return { parts, taskLines };
  }, [text, isDaily, resolve]);

  // Match rendered checkboxes to task lines in the note, in order.
  useEffect(() => {
    const boxes = [...ref.current.querySelectorAll('input[type="checkbox"]')];
    ref.current.querySelectorAll('a[href^="http"]').forEach((a) => { a.target = "_blank"; a.rel = "noopener"; });
    if (!interactive || boxes.length !== taskLines.length) return;
    boxes.forEach((b, n) => {
      b.disabled = false;
      b.onchange = () => processFile(path, edit.done({ line: taskLines[n] }, b.checked));
    });
  }, [parts, taskLines, interactive, path, processFile]);

  const onClick = (e) => {
    const a = e.target.closest("a");
    if (a && a.getAttribute("href")?.startsWith("/note/")) {
      e.preventDefault();
      router.push(a.getAttribute("href"));
    }
  };

  const due = isDaily
    ? pages.filter((p) => !p.file.path.startsWith(TPL + "/")).flatMap((p) => p.file.tasks)
        .filter((t) => !t.completed && t.due && dayKey(t.due) === fileName(path))
    : [];

  return (
    <div ref={ref} className="b-md" onClick={onClick}>
      {parts.map((html, i) => (
        <div key={i}>
          <div dangerouslySetInnerHTML={{ __html: html }} />
          {i < parts.length - 1 && (
            <div className="b-list">
              {!due.length && <Empty>Nothing due on this day.</Empty>}
              {due.map((t) => (
                <div key={t.path + t.line} className="b-task">
                  <div className="b-chk" role="checkbox" aria-checked="false" onClick={() => processFile(t.path, edit.done(t, true), `Done: ${clean(t)}`)} />
                  <div className="b-task-m" onClick={() => router.push(noteHref(t.path))}>
                    <div className="b-task-t">{clean(t)}</div>
                    <div className="b-task-s"><span>{fileName(t.path)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
