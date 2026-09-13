import type { Project, Task } from "./types";

export const demoProjects: Project[] = [
  {
    id: "scope-launch",
    name: "Scope Launch",
    description: "Die erste öffentliche Version von Scope vorbereiten.",
    color: "#8CA8FF",
    progress: 62,
    members: ["NK", "LM", "AS"],
  },
  {
    id: "website",
    name: "Website",
    description: "Positionierung und Open-Source-Dokumentation.",
    color: "#8FE0B0",
    progress: 28,
    members: ["NK", "LM"],
  },
];

export const demoTasks: Task[] = [
  { id: "1", key: "SCO-18", title: "Onboarding für Team-Workspaces verfeinern", description: "Einladungen und optionale KI-Einrichtung in einem ruhigen Ablauf zusammenführen.", status: "in-progress", priority: "high", dueDate: "2026-09-10", assignee: "NK", labels: ["Design"], subtasks: [{ id: "1a", title: "Empty state schreiben", done: true }, { id: "1b", title: "Mobile Variante prüfen", done: false }], comments: 4 },
  { id: "2", key: "SCO-19", title: "Provider-Verbindung testen", description: "Fehlerzustände für lokale und gehostete Modelle vereinheitlichen.", status: "review", priority: "medium", dueDate: "2026-09-11", assignee: "AS", labels: ["AI", "Backend"], subtasks: [], comments: 2 },
  { id: "3", key: "SCO-20", title: "Installationsskript auf ARM prüfen", description: "Frische Ubuntu-Instanz und Raspberry Pi 5 testen.", status: "backlog", priority: "medium", dueDate: "2026-09-14", assignee: "LM", labels: ["Self-host"], subtasks: [], comments: 0 },
  { id: "4", key: "SCO-21", title: "Keyboard-Navigation im Board", description: "Karten ohne Drag-and-drop zwischen Spalten verschieben.", status: "in-progress", priority: "urgent", dueDate: "2026-09-10", assignee: "NK", labels: ["Accessibility"], subtasks: [], comments: 5 },
  { id: "5", key: "SCO-22", title: "Dark-Mode Logo exportieren", description: "Optimiertes SVG und PWA-Icon vorbereiten.", status: "done", priority: "low", dueDate: "2026-09-08", assignee: "LM", labels: ["Brand"], subtasks: [], comments: 1 },
  { id: "6", key: "SCO-23", title: "Release Notes entwerfen", description: "Klar erklären, was der erste Release kann und bewusst noch nicht kann.", status: "backlog", priority: "low", dueDate: "2026-09-18", assignee: "AS", labels: ["Writing"], subtasks: [], comments: 0 },
];

export const statusLabels = {
  backlog: "Geplant",
  "in-progress": "In Arbeit",
  review: "Review",
  done: "Erledigt",
} as const;
