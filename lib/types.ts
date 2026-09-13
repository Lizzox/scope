export type TaskStatus = "backlog" | "in-progress" | "review" | "done";
export type Priority = "low" | "medium" | "high" | "urgent";
export type ViewMode = "list" | "board" | "calendar";
export type AutonomyLevel = "suggest" | "automation" | "agentic";
export type Appearance = "system" | "light" | "dark";

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  progress: number;
  members: string[];
  key?: string;
  icon?: string;
  logoDataUrl?: string | null;
}

export interface Task {
  id: string;
  key: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string;
  assignee: string;
  assigneeId?: string | null;
  labels: string[];
  labelIds?: string[];
  subtasks: { id: string; title: string; done: boolean }[];
  comments: number;
  projectId?: string;
  version?: number;
  milestoneId?: string | null;
  blockedBy?: string[];
  blocking?: string[];
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description: string;
  color: string;
  status: "planned" | "active" | "at_risk" | "completed" | "cancelled";
  targetDate: string;
  progress?: number;
  totalTasks?: number;
  completedTasks?: number;
}

export interface TaskDependency { id: string; blockerTaskId: string; blockedTaskId: string; }
export interface SavedView { id: string; workspaceId: string; projectId?: string | null; name: string; scope: "personal" | "project" | "workspace"; filters: { version: 1; conditions: Array<{ field: string; operator: string; value?: string | boolean | string[] }> }; sort: { field: string; direction: "asc" | "desc" }; grouping?: string | null; layout: ViewMode; }

export interface OnboardingState {
  mode: "solo" | "team";
  name: string;
  email: string;
  password: string;
  workspace: string;
  provider: string;
  providerApiKey: string;
  providerEndpoint: string;
  template: string;
}
