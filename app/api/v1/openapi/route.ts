import { NextResponse } from "next/server";

const idempotency = [
  {
    in: "header",
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string" },
  },
];
const response = (description: string) => ({ "200": { description } });
const collection = (name: string) => ({
  get: { summary: `List ${name}`, responses: response(name) },
  post: {
    summary: `Create ${name}`,
    parameters: idempotency,
    responses: { "201": { description: "Created" } },
  },
});

const document = {
  openapi: "3.1.0",
  info: {
    title: "Scope API",
    version: "0.2.0",
    description:
      "Versioned, session-authenticated API for the self-hosted Scope planner.",
  },
  servers: [{ url: "/api/v1" }],
  paths: {
    "/dashboard": {
      get: {
        summary: "Read workspace planning metrics",
        responses: response("Dashboard"),
      },
    },
    "/projects": collection("projects"),
    "/tasks": collection("tasks"),
    "/tasks/{taskId}": {
      patch: {
        summary: "Update a task with optimistic concurrency",
        responses: {
          ...response("Updated"),
          "409": { description: "Version conflict" },
        },
      },
    },
    "/tasks/{taskId}/comments": collection("task comments"),
    "/tasks/{taskId}/labels": {
      put: { summary: "Replace task labels", responses: response("Updated") },
    },
    "/labels": collection("labels"),
    "/milestones": collection("milestones"),
    "/task-dependencies": collection("task dependencies"),
    "/recurrence-rules": collection("recurrence rules"),
    "/saved-views": collection("saved views"),
    "/attachments": collection("attachments"),
    "/notifications": {
      get: {
        summary: "List notifications",
        responses: response("Notifications"),
      },
      patch: {
        summary: "Mark notifications read",
        responses: response("Updated"),
      },
    },
    "/notification-preferences": {
      get: {
        summary: "Read notification preferences",
        responses: response("Preferences"),
      },
      put: {
        summary: "Save notification preferences",
        responses: response("Saved"),
      },
    },
    "/automations": collection("no-code automations"),
    "/automation-runs": {
      get: { summary: "List automation runs", responses: response("Runs") },
    },
    "/meetings": collection("meetings"),
    "/meetings/{meetingId}/transcribe": {
      post: {
        summary: "Queue meeting transcription",
        responses: { "202": { description: "Queued" } },
      },
    },
    "/meetings/{meetingId}/summarize": {
      post: {
        summary: "Create a reviewable AI meeting summary",
        responses: response("Summary and proposals"),
      },
    },
    "/meeting-integrations": collection("meeting bot integrations"),
    "/meeting-integrations/{integrationId}/teams-import": {
      post: {
        summary: "Import an official Microsoft Teams transcript",
        responses: { "201": { description: "Meeting created" } },
      },
    },
    "/ai/providers/{providerId}/models": {
      post: { summary: "Fetch provider models", responses: response("Models") },
    },
    "/ai/usage": {
      get: { summary: "Read AI usage", responses: response("Usage") },
    },
    "/ai/runs": {
      post: {
        summary: "Create a reviewable AI proposal",
        responses: { "201": { description: "Proposal" } },
      },
    },
    "/admin/instance": {
      get: {
        summary: "Read self-hosting health",
        responses: response("Instance health"),
      },
      patch: {
        summary: "Update safe instance settings",
        responses: response("Updated"),
      },
    },
  },
};

export function GET() {
  return NextResponse.json(document);
}
