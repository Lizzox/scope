import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const autonomySchema = z.enum(["suggest", "automation", "agentic"]);
export const roleSchema = z.enum(["owner", "admin", "member"]);
export const statusSchema = z.enum([
  "backlog",
  "in-progress",
  "review",
  "done",
]);
export const prioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export const milestoneStatusSchema = z.enum([
  "planned",
  "active",
  "at_risk",
  "completed",
  "cancelled",
]);
export const viewLayoutSchema = z.enum(["list", "board", "calendar"]);

export const setupSchema = z.object({
  setupToken: z.string().optional(),
  name: z.string().trim().min(2).max(100),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(10).max(256),
  mode: z.enum(["solo", "team"]),
  workspace: z.string().trim().min(2).max(100),
  locale: z.enum(["de", "en"]).default("de"),
  template: z
    .enum(["blank", "software", "marketing", "personal"])
    .default("blank"),
  provider: z
    .object({
      type: z.enum([
        "openai",
        "anthropic",
        "gemini",
        "openrouter",
        "ollama",
        "compatible",
      ]),
      name: z.string().min(1).max(80),
      endpoint: z.url().optional(),
      apiKey: z.string().min(1).max(1000).optional(),
      model: z.string().max(200).optional(),
    })
    .optional(),
});

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(256),
});
const projectIconSchema = z.enum([
  "folder",
  "code",
  "rocket",
  "megaphone",
  "target",
  "briefcase",
  "palette",
  "globe",
]);
const projectLogoSchema = z
  .string()
  .max(700_000)
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
  .nullable()
  .optional();
export const projectCreateSchema = z.object({
  workspaceId: uuidSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().max(20_000).default(""),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#8CA8FF"),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{1,7}$/)
    .default("SCO"),
  icon: projectIconSchema.default("folder"),
  logoDataUrl: projectLogoSchema,
});
export const projectUpdateSchema = projectCreateSchema
  .omit({ workspaceId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0);
export const taskCreateSchema = z.object({
  projectId: uuidSchema,
  title: z.string().trim().min(1).max(300),
  description: z.string().max(20_000).default(""),
  status: statusSchema.default("backlog"),
  priority: prioritySchema.default("medium"),
  dueDate: z.iso.date().nullable().optional(),
  assigneeId: uuidSchema.nullable().optional(),
  parentId: uuidSchema.nullable().optional(),
  milestoneId: uuidSchema.nullable().optional(),
});
export const taskUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().max(20_000).optional(),
    status: statusSchema.optional(),
    priority: prioritySchema.optional(),
    dueDate: z.iso.date().nullable().optional(),
    assigneeId: uuidSchema.nullable().optional(),
    parentId: uuidSchema.nullable().optional(),
    milestoneId: uuidSchema.nullable().optional(),
    version: z.number().int().positive(),
  })
  .refine((value) => Object.keys(value).length > 1);
export const commentCreateSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
});
export const labelCreateSchema = z.object({
  workspaceId: uuidSchema,
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export const taskLabelsUpdateSchema = z.object({
  labelIds: z.array(uuidSchema).max(50),
});
export const invitationCreateSchema = z.object({
  workspaceId: uuidSchema,
  role: z.enum(["admin", "member"]).default("member"),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});
export const inviteAcceptSchema = z
  .object({
    token: z.string().min(24).max(200),
    name: z.string().trim().min(2).max(100).optional(),
    email: z.email().trim().toLowerCase().optional(),
    password: z.string().min(10).max(256).optional(),
  })
  .refine(
    (value) =>
      (!value.name && !value.email && !value.password) ||
      Boolean(value.name && value.email && value.password),
    { message: "Name, E-Mail und Passwort werden gemeinsam benötigt." },
  );
export const providerCreateSchema = z.object({
  workspaceId: uuidSchema,
  provider: z.enum([
    "openai",
    "anthropic",
    "gemini",
    "openrouter",
    "ollama",
    "compatible",
  ]),
  name: z.string().trim().min(1).max(80),
  endpoint: z.url().optional(),
  apiKey: z.string().max(1000).optional(),
  models: z.array(z.string().max(200)).max(100).default([]),
});
export const aiRunCreateSchema = z.object({
  workspaceId: uuidSchema,
  projectId: uuidSchema,
  providerConfigId: uuidSchema,
  model: z.string().min(1).max(200),
  autonomy: autonomySchema,
  prompt: z.string().trim().min(1).max(20_000),
});
export const proposalApplySchema = z.object({
  operationIds: z.array(z.string().min(1)).min(1).max(50),
});
export const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    locale: z.enum(["de", "en"]).optional(),
    appearance: z.enum(["system", "light", "dark"]).optional(),
    preferredAutonomy: autonomySchema.optional(),
    themePreferences: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);
export const workspaceUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100),
});
export const membershipUpdateSchema = z.object({
  role: z.enum(["admin", "member"]),
});
export const aiPolicyUpdateSchema = z
  .object({
    maxAutonomy: autonomySchema.optional(),
    monthlyTokenBudget: z.number().int().positive().nullable().optional(),
    maxTokensPerRun: z.number().int().min(256).max(200_000).optional(),
    allowedProjectIds: z.array(uuidSchema).max(500).optional(),
    allowedActions: z
      .array(
        z.enum([
          "task.create",
          "task.update",
          "subtask.create",
          "milestone.create",
          "dependency.create",
        ]),
      )
      .max(10)
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export const milestoneCreateSchema = z.object({
  projectId: uuidSchema,
  name: z.string().trim().min(1).max(160),
  description: z.string().max(10_000).default(""),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#8CA8FF"),
  status: milestoneStatusSchema.default("planned"),
  targetDate: z.iso.date().nullable().optional(),
});
export const milestoneUpdateSchema = milestoneCreateSchema
  .omit({ projectId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0);
export const dependencyCreateSchema = z
  .object({ blockerTaskId: uuidSchema, blockedTaskId: uuidSchema })
  .refine((value) => value.blockerTaskId !== value.blockedTaskId, {
    message: "Eine Aufgabe kann sich nicht selbst blockieren.",
  });
const filterConditionSchema = z.object({
  field: z.enum([
    "projectId",
    "status",
    "priority",
    "assigneeId",
    "labelId",
    "milestoneId",
    "due",
    "blocked",
  ]),
  operator: z.enum([
    "eq",
    "neq",
    "in",
    "notIn",
    "before",
    "after",
    "isEmpty",
    "isNotEmpty",
  ]),
  value: z.union([z.string(), z.boolean(), z.array(z.string())]).optional(),
});
export const savedViewCreateSchema = z.object({
  workspaceId: uuidSchema,
  projectId: uuidSchema.nullable().optional(),
  name: z.string().trim().min(1).max(120),
  scope: z.enum(["personal", "project", "workspace"]).default("personal"),
  filters: z
    .object({
      version: z.literal(1).default(1),
      conditions: z.array(filterConditionSchema).max(20).default([]),
    })
    .default({ version: 1, conditions: [] }),
  sort: z
    .object({
      field: z.enum([
        "position",
        "title",
        "dueDate",
        "priority",
        "createdAt",
        "updatedAt",
      ]),
      direction: z.enum(["asc", "desc"]),
    })
    .default({ field: "position", direction: "asc" }),
  grouping: z
    .enum(["status", "priority", "assignee", "label", "milestone"])
    .nullable()
    .optional(),
  layout: viewLayoutSchema.default("list"),
});
export const savedViewUpdateSchema = savedViewCreateSchema
  .omit({ workspaceId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0);
export const recurrenceCreateSchema = z.object({
  projectId: uuidSchema,
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval: z.number().int().min(1).max(365).default(1),
  weekDays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  monthDay: z.number().int().min(1).max(31).nullable().optional(),
  timezone: z.string().min(1).max(80).default("UTC"),
  generationMode: z.enum(["schedule", "completion"]).default("schedule"),
  nextOccurrenceAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable().optional(),
  taskTemplate: z.object({
    title: z.string().trim().min(1).max(300),
    description: z.string().max(20_000).default(""),
    priority: prioritySchema.default("medium"),
    status: statusSchema.default("backlog"),
    assigneeId: uuidSchema.nullable().optional(),
    milestoneId: uuidSchema.nullable().optional(),
    dueOffsetDays: z.number().int().min(0).max(3650).default(0),
    labelIds: z.array(uuidSchema).max(50).default([]),
  }),
});
export const recurrenceUpdateSchema = recurrenceCreateSchema
  .omit({ projectId: true })
  .partial()
  .extend({ active: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0);
export const notificationUpdateSchema = z
  .object({
    ids: z.array(uuidSchema).max(200).optional(),
    all: z.boolean().optional(),
    read: z.boolean().default(true),
  })
  .refine((value) => value.all || Boolean(value.ids?.length));
export const notificationPreferencesSchema = z.object({
  workspaceId: uuidSchema,
  channels: z.object({
    inApp: z.literal(true).default(true),
    email: z.boolean().default(false),
    push: z.boolean().default(false),
  }),
  digest: z.enum(["instant", "off"]).default("instant"),
  quietHours: z
    .object({
      enabled: z.boolean().default(false),
      start: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .optional(),
      end: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .optional(),
      timezone: z.string().max(80).optional(),
    })
    .default({ enabled: false }),
});
const automationTriggerSchema = z.object({
  type: z.enum([
    "task.created",
    "task.updated",
    "task.status_changed",
    "task.due",
    "comment.created",
    "milestone.at_risk",
    "schedule",
  ]),
  schedule: z.string().max(120).optional(),
});
const automationConditionSchema = z.object({
  field: z.string().min(1).max(80),
  operator: z.enum(["eq", "neq", "in", "contains", "changedTo", "changedFrom"]),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
});
const automationActionSchema = z.object({
  type: z.enum([
    "task.update",
    "task.create",
    "label.add",
    "label.remove",
    "notification.send",
    "ai.proposal",
  ]),
  config: z.record(z.string(), z.unknown()).default({}),
});
export const automationCreateSchema = z.object({
  workspaceId: uuidSchema,
  projectId: uuidSchema.nullable().optional(),
  name: z.string().trim().min(1).max(160),
  description: z.string().max(2000).default(""),
  status: z.enum(["draft", "active", "paused", "disabled"]).default("draft"),
  trigger: automationTriggerSchema,
  conditions: z.array(automationConditionSchema).max(20).default([]),
  actions: z.array(automationActionSchema).min(1).max(10),
});
export const automationUpdateSchema = automationCreateSchema
  .omit({ workspaceId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0);
export const meetingCreateSchema = z.object({
  workspaceId: uuidSchema,
  projectId: uuidSchema.nullable().optional(),
  title: z.string().trim().min(1).max(240),
  source: z.enum(["live", "upload"]),
  language: z.string().min(2).max(40).default("de"),
  consentConfirmed: z.literal(true),
});
export const meetingUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(240).optional(),
    projectId: uuidSchema.nullable().optional(),
    recordingAttachmentId: uuidSchema.nullable().optional(),
    transcript: z.string().max(2_000_000).optional(),
    status: z
      .enum([
        "recording",
        "uploaded",
        "transcribing",
        "summarizing",
        "review",
        "completed",
        "failed",
      ])
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0);
export const meetingSummaryRequestSchema = z.object({
  providerConfigId: uuidSchema,
  model: z.string().min(1).max(200),
});
export const adminSettingsSchema = z
  .object({
    storageProvider: z.enum(["local", "s3"]).optional(),
    updateChecksEnabled: z.boolean().optional(),
    maxAttachmentBytes: z
      .number()
      .int()
      .min(1_048_576)
      .max(2_000_000_000)
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0);
