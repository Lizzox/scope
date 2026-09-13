import { describe, expect, it } from "vitest";
import { automationCreateSchema, dependencyCreateSchema, meetingCreateSchema, milestoneCreateSchema, projectCreateSchema, savedViewCreateSchema, taskUpdateSchema } from "./validation";

describe("taskUpdateSchema", () => {
  it("does not add create defaults to a partial update", () => {
    expect(taskUpdateSchema.parse({ status: "review", version: 3 })).toEqual({ status: "review", version: 3 });
  });

  it("accepts safe project branding and rejects SVG data", () => {
    const base = { workspaceId: crypto.randomUUID(), name: "Launch", key: "WEB", color: "#8CA8FF" };
    expect(projectCreateSchema.safeParse({ ...base, icon: "rocket", logoDataUrl: "data:image/png;base64,aGVsbG8=" }).success).toBe(true);
    expect(projectCreateSchema.safeParse({ ...base, logoDataUrl: "data:image/svg+xml;base64,PHN2Zz4=" }).success).toBe(false);
  });

  it("validates milestones, dependency cycles at the boundary and versioned views", () => {
    const projectId = crypto.randomUUID(); const workspaceId = crypto.randomUUID(); const taskId = crypto.randomUUID();
    expect(milestoneCreateSchema.safeParse({ projectId, name: "Release", targetDate: "2026-10-01" }).success).toBe(true);
    expect(dependencyCreateSchema.safeParse({ blockerTaskId: taskId, blockedTaskId: taskId }).success).toBe(false);
    expect(savedViewCreateSchema.safeParse({ workspaceId, name: "Dringend", filters: { version: 1, conditions: [{ field: "priority", operator: "eq", value: "urgent" }] } }).success).toBe(true);
  });

  it("keeps automation actions bounded and meeting consent explicit", () => {
    const workspaceId = crypto.randomUUID();
    expect(automationCreateSchema.safeParse({ workspaceId, name: "Hinweis", trigger: { type: "task.created" }, actions: [{ type: "notification.send", config: { title: "Neu" } }] }).success).toBe(true);
    expect(meetingCreateSchema.safeParse({ workspaceId, title: "Weekly", source: "live", language: "de", consentConfirmed: false }).success).toBe(false);
  });
});
