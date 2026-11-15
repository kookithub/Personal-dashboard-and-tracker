// Made-up notes and settings for guest mode (the "Look around as a guest" button on the login
// screen). Nothing here is real data; dates are set around today so the dashboard looks alive.
// Guests never talk to the server: AppProvider answers their requests from memory, so nothing is
// saved and none of the owner's data is ever loaded.
import moment from "moment";

export function demoData() {
  const d = (n) => moment().add(n, "days").format("YYYY-MM-DD");
  const now = Date.now();
  const files = {
    "Life/Tasks.md": `# Tasks\n\n## Tasks\n- [ ] Buy groceries [due:: ${d(0)}]\n- [ ] Call the dentist [due:: ${d(-1)}]\n- [ ] Pay phone bill [due:: ${d(3)}]\n- [ ] Plan weekend trip\n\t- [x] Pick a place\n\t- [ ] Book train [due:: ${d(5)}]\n\t- [ ] Pack bag\n- [ ] Read 20 pages\n- [x] Water the plants\n`,
    "Projects/Portfolio Website.md": `---\nstatus: active\narea: design\ndeadline: ${d(12)}\n---\n# Portfolio Website\n\n## Tasks\n- [x] Sketch layout\n- [x] Pick fonts and colors\n- [ ] Write the about page [due:: ${d(2)}]\n- [ ] Add three case studies\n- [ ] Publish\n`,
    "Projects/Habit Tracker App.md": `---\nstatus: active\narea: code\n---\n# Habit Tracker App\n\n## Tasks\n- [x] Data model\n- [ ] Streaks screen [due:: ${d(6)}]\n- [ ] Reminders\n`,
    "Projects/Photo Book.md": "---\nstatus: paused\narea: hobby\n---\n# Photo Book\n\n- [x] Choose 40 photos\n- [ ] Order prints\n",
    "Projects/Garage Sale.md": "---\nstatus: done\n---\n# Garage Sale\n\n- [x] Sort boxes\n- [x] Price tags\n- [x] Sell everything\n",
    "Academic/Statistics.md": `---\ncode: STAT 101\n---\n# Statistics\n\n## Exams\n- [ ] Midterm [due:: ${d(9)}]\n\t- [x] Chapter 1: Data\n\t- [x] Chapter 2: Probability\n\t- [ ] Chapter 3: Distributions\n\t- [ ] Practice exam\n\n## Project\n- [ ] Survey analysis [due:: ${d(14)}]\n`,
    "Academic/World History.md": `---\ncode: HIST 120\n---\n# World History\n\n## Exams\n- [ ] Final [due:: ${d(20)}]\n\t- [x] Ancient Greece\n\t- [ ] Rome\n\t- [ ] Middle Ages\n`,
    "Life/Ongoing/Running.md": "---\nstarted: 2025-03-01\n---\n# Running\n\nThree runs a week. Longest so far: 12 km.\n",
    "Life/Ongoing/Learning Spanish.md": "---\nstarted: 2025-09-15\n---\n# Learning Spanish\n\n15 minutes a day.\n",
    "Life/Data Map.md": "# Data Map\n\nWhere things are kept (sample):\n\n- Photos: cloud drive\n- Documents: laptop + backup drive\n",
    "Life/Money Map.md": "# Money Map\n\nA made-up example:\n\n| Account | Purpose |\n|---|---|\n| Everyday | bills and food |\n| Savings | trips |\n",
    [`Daily/${d(0)}.md`]: `# ${d(0)}\n\n- Morning walk\n- Finish the about page draft\n`,
    "Templates/Project.md": "---\nstatus: active\n---\n# {{title}}\n\n## Tasks\n- [ ] First step\n",
    "Templates/Course.md": "---\ncode: \n---\n# {{title}}\n\n## Exams\n\n## Project\n",
    "Templates/Daily.md": "# {{date}}\n\n",
  };
  return {
    files: Object.entries(files).map(([path, content], i) => ({ path, content, mtime: now - i * 3_600_000 })),
    settings: {
      dashboard: {
        title: "Demo",
        mantra: "guest mode · sample data",
        palette: "hyper",
        buddies: [{ id: "demo", on: true, kind: "pixcat", motion: "explore", activity: "lively", speed: "normal", size: 76, lines: ["Hi, guest!", "This is sample data.", "You have {due} due today."] }],
      },
    },
  };
}
