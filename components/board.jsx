"use client";
// Everything the dashboard shows, worked out from the notes: tasks by due date,
// courses and their exam study, projects, ongoing things, calendar marks.
import { createContext, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { M, TPL, clean, dayKey, folderPath, isActive, isStudy, noteHref } from "@/lib/notes";
import { shownTabs } from "@/lib/layout";
import { useApp } from "./AppProvider";

export const BoardCtx = createContext(null);
export const useBoard = () => useContext(BoardCtx);

export function useBoardData() {
  const { files, pages, dash } = useApp();
  const todayKey = M().format("YYYY-MM-DD");
  return useMemo(() => {
    const today = M(todayKey);
    const DAILY = folderPath(files, "Daily");
    const ACADEMIC = folderPath(files, "Academic");
    const PROJECTS = folderPath(files, "Projects");
    const LIFE = folderPath(files, "Life");
    const ONGOING = `${LIFE}/Ongoing`;
    const INBOX = `${LIFE}/Tasks.md`;
    const pagesIn = (folder) => pages.filter((p) => p.file.path.startsWith(folder + "/"));
    const byName = (a, b) => a.file.name.localeCompare(b.file.name);
    const byDue = (a, b) => (a.d ? a.d.valueOf() : Infinity) - (b.d ? b.d.valueOf() : Infinity);

    const tabNames = shownTabs(dash);

    const links = (Array.isArray(dash.links) && dash.links.length ? dash.links : [
      `Data Map | ${LIFE}/Data Map | database`,
      `Money Map | ${LIFE}/Money Map | wallet`,
    ])
      .map((s) => String(s).split("|").map((x) => x.trim()))
      .filter(([name, target]) => name && target)
      .map(([name, target, icon]) => ({ name, target, icon: icon || "link" }));

    const notTpl = pages.filter((p) => !p.file.path.startsWith(TPL + "/"));
    const allTasks = notTpl.flatMap((p) => p.file.tasks);
    // Exams and their study steps are kept apart from tasks; only the calendar shows both.
    const isExam = (t) => t.path.startsWith(ACADEMIC + "/") && isStudy(t);
    const allOpen = allTasks.filter((t) => !t.completed && clean(t));
    const openTasks = allOpen.filter((t) => !isExam(t));
    const withDue = openTasks.map((t) => ({ t, d: t.due }));
    const dated = withDue.filter((x) => x.d).sort(byDue);
    const overdue = dated.filter((x) => x.d.isBefore(today));
    const dueToday = dated.filter((x) => x.d.isSame(today, "day"));
    const thisWeek = dated.filter((x) => x.d.isAfter(today) && x.d.diff(today, "days") <= 7);
    const later = dated.filter((x) => x.d.diff(today, "days") > 7);
    const examDated = allOpen.filter(isExam).map((t) => ({ t, d: t.due })).filter((x) => x.d).sort(byDue);
    const calDated = [...dated, ...examDated].sort(byDue);

    // Notes whose status is done / paused / archived… are kept in their own "not active" lists.
    const allCourses = pagesIn(ACADEMIC).sort(byName);
    const courses = allCourses.filter(isActive);
    const coursesOff = allCourses.filter((p) => !isActive(p));
    const allProjects = pagesIn(PROJECTS).sort(byName);
    const projects = allProjects.filter(isActive);
    const projectsOff = allProjects.filter((p) => !isActive(p));
    const allOngoing = pagesIn(ONGOING).sort(byName);
    const ongoing = allOngoing.filter(isActive);
    const ongoingOff = allOngoing.filter((p) => !isActive(p));
    const bigTasks = allTasks
      .filter((t) => t.parent == null && t.children?.length && clean(t) && !isExam(t))
      .sort((a, b) => (a.completed - b.completed) || byDue({ d: a.due }, { d: b.due }));
    const single = withDue.filter((x) => x.t.parent == null && !x.t.children?.length);
    // Ticked tasks stay reachable (Tasks tab > Done), so a tick can be taken back.
    const doneSingle = allTasks
      .filter((t) => t.completed && clean(t) && !isExam(t) && t.parent == null && !t.children?.length)
      .map((t) => ({ t, d: t.due }));

    // Exam study = subtasks of tasks under a course's "Exams" heading. Exam prep counts active courses only.
    const study = new Map(allCourses.map((p) => {
      const all = p.file.tasks.filter((t) => clean(t) && isStudy(t));
      const steps = all.filter((t) => t.parent != null);
      return [p.file.path, { exams: all.filter((t) => t.parent == null), steps, done: steps.filter((t) => t.completed).length }];
    }));
    const activeStudy = courses.map((p) => study.get(p.file.path));
    const studyDone = activeStudy.reduce((n, s) => n + s.done, 0);
    const studyTotal = activeStudy.reduce((n, s) => n + s.steps.length, 0);

    const dailySet = new Set(pagesIn(DAILY).filter((p) => p.file.folder === DAILY).map((p) => p.file.name));
    const dueSet = new Set(calDated.map((x) => dayKey(x.d)));

    const dueLabel = (d) => {
      const n = d.diff(today, "days");
      if (n < 0) return n === -1 ? "yesterday" : `${-n} days late`;
      if (n === 0) return "today";
      if (n === 1) return "tomorrow";
      if (n < 7) return d.format("dddd");
      return d.format("D MMM");
    };

    return {
      today, DAILY, ACADEMIC, PROJECTS, LIFE, ONGOING, INBOX, tabNames, links, notTpl,
      openTasks, withDue, dated, overdue, dueToday, thisWeek, later, calDated,
      courses, coursesOff, projects, projectsOff, ongoing, ongoingOff, bigTasks, single, doneSingle, study, studyDone, studyTotal, dailySet, dueSet, dueLabel, byDue,
    };
  }, [files, pages, dash, todayKey]);
}

// Opening notes and making new ones.
export function useNav() {
  const router = useRouter();
  const app = useApp();
  const openPath = (target) => {
    if (/^https?:\/\//.test(target)) return window.open(target, "_blank", "noopener");
    router.push(noteHref(app.resolve(target) || target));
  };
  const createAndOpen = async (folder, name, tpl, date) => {
    try { openPath(await app.ensureNote(folder, name, tpl, date)); } catch {}
  };
  return { openPath, createAndOpen };
}
