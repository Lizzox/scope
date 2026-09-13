import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("membership_role", ["owner", "admin", "member"]);
export const projectStatusEnum = pgEnum("project_status", [
  "active",
  "paused",
  "completed",
]);
export const taskStatusEnum = pgEnum("task_status", [
  "backlog",
  "in-progress",
  "review",
  "done",
]);
export const priorityEnum = pgEnum("priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);
export const autonomyEnum = pgEnum("autonomy_level", [
  "suggest",
  "automation",
  "agentic",
]);
export const aiRunStatusEnum = pgEnum("ai_run_status", [
  "queued",
  "running",
  "review",
  "applied",
  "failed",
  "cancelled",
]);
export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);
export const milestoneStatusEnum = pgEnum("milestone_status", [
  "planned",
  "active",
  "at_risk",
  "completed",
  "cancelled",
]);
export const attachmentStatusEnum = pgEnum("attachment_status", [
  "pending",
  "ready",
  "quarantined",
  "deleted",
]);
export const meetingStatusEnum = pgEnum("meeting_status", [
  "recording",
  "uploaded",
  "transcribing",
  "summarizing",
  "review",
  "completed",
  "failed",
]);
export const automationStatusEnum = pgEnum("automation_status", [
  "draft",
  "active",
  "paused",
  "disabled",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const instanceSetup = pgTable("instance_setup", {
  id: uuid("id").primaryKey().defaultRandom(),
  setupComplete: boolean("setup_complete").notNull().default(false),
  setupTokenHash: text("setup_token_hash"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    locale: text("locale").notNull().default("de"),
    appearance: text("appearance").notNull().default("system"),
    themePreferences: jsonb("theme_preferences").notNull().default({}),
    preferredAutonomy: autonomyEnum("preferred_autonomy")
      .notNull()
      .default("suggest"),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("sessions_token_hash_unique").on(table.tokenHash)],
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    mode: text("mode").notNull().default("solo"),
    nextTaskNumber: integer("next_task_number").notNull().default(1),
    ...timestamps,
  },
  (table) => [uniqueIndex("workspaces_slug_unique").on(table.slug)],
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("member"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("membership_workspace_user_unique").on(
      table.workspaceId,
      table.userId,
    ),
  ],
);

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  role: roleEnum("role").notNull().default("member"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedBy: uuid("used_by").references(() => users.id, { onDelete: "set null" }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ...timestamps,
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  color: text("color").notNull().default("#8CA8FF"),
  icon: text("icon").notNull().default("folder"),
  logoDataUrl: text("logo_data_url"),
  key: text("key").notNull().default("SCO"),
  status: projectStatusEnum("status").notNull().default("active"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  ...timestamps,
});

export const milestones = pgTable("milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  color: text("color").notNull().default("#8CA8FF"),
  status: milestoneStatusEnum("status").notNull().default("planned"),
  targetDate: timestamp("target_date", { withTimezone: true }),
  position: integer("position").notNull().default(0),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  ...timestamps,
});

export const recurrenceRules = pgTable("recurrence_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  frequency: text("frequency").notNull(),
  interval: integer("interval").notNull().default(1),
  weekDays: jsonb("week_days").notNull().default([]),
  monthDay: integer("month_day"),
  timezone: text("timezone").notNull().default("UTC"),
  generationMode: text("generation_mode").notNull().default("schedule"),
  taskTemplate: jsonb("task_template").notNull().default({}),
  nextOccurrenceAt: timestamp("next_occurrence_at", {
    withTimezone: true,
  }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  ...timestamps,
});

export const labels = pgTable("labels", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull(),
  ...timestamps,
});

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    milestoneId: uuid("milestone_id").references(() => milestones.id, {
      onDelete: "set null",
    }),
    recurrenceRuleId: uuid("recurrence_rule_id").references(
      () => recurrenceRules.id,
      { onDelete: "set null" },
    ),
    recurrenceOccurrenceAt: timestamp("recurrence_occurrence_at", {
      withTimezone: true,
    }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: taskStatusEnum("status").notNull().default("backlog"),
    priority: priorityEnum("priority").notNull().default("medium"),
    position: integer("position").notNull().default(0),
    assigneeId: uuid("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("task_project_number_unique").on(table.projectId, table.number),
    uniqueIndex("task_recurrence_occurrence_unique").on(
      table.recurrenceRuleId,
      table.recurrenceOccurrenceAt,
    ),
  ],
);

export const taskDependencies = pgTable(
  "task_dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockerTaskId: uuid("blocker_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    blockedTaskId: uuid("blocked_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("task_dependency_unique").on(
      table.blockerTaskId,
      table.blockedTaskId,
    ),
  ],
);

export const taskLabels = pgTable(
  "task_labels",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("task_label_unique").on(table.taskId, table.labelId)],
);

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  ...timestamps,
});

export const savedViews = pgTable("saved_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  scope: text("scope").notNull().default("personal"),
  filters: jsonb("filters").notNull().default({ version: 1, conditions: [] }),
  sort: jsonb("sort")
    .notNull()
    .default({ field: "position", direction: "asc" }),
  grouping: text("grouping"),
  layout: text("layout").notNull().default("list"),
  ...timestamps,
});

export const attachments = pgTable("attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references(() => users.id),
  storageProvider: text("storage_provider").notNull().default("local"),
  objectKey: text("object_key").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  status: attachmentStatusEnum("status").notNull().default("pending"),
  aiAllowed: boolean("ai_allowed").notNull().default(false),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id, {
    onDelete: "set null",
  }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  data: jsonb("data").notNull().default({}),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channels: jsonb("channels")
      .notNull()
      .default({ inApp: true, email: false, push: false }),
    quietHours: jsonb("quiet_hours").notNull().default({}),
    digest: text("digest").notNull().default("instant"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("notification_preferences_workspace_user_unique").on(
      table.workspaceId,
      table.userId,
    ),
  ],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    subscription: jsonb("subscription").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("push_subscription_endpoint_unique").on(table.endpoint),
  ],
);

export const automations = pgTable("automations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: automationStatusEnum("status").notNull().default("draft"),
  trigger: jsonb("trigger").notNull(),
  conditions: jsonb("conditions").notNull().default([]),
  actions: jsonb("actions").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  ...timestamps,
});

export const meetings = pgTable("meetings", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  source: text("source").notNull().default("upload"),
  status: meetingStatusEnum("status").notNull().default("uploaded"),
  language: text("language").notNull().default("auto"),
  consentConfirmedAt: timestamp("consent_confirmed_at", {
    withTimezone: true,
  }).notNull(),
  consentConfirmedBy: uuid("consent_confirmed_by")
    .notNull()
    .references(() => users.id),
  recordingAttachmentId: uuid("recording_attachment_id").references(
    () => attachments.id,
    { onDelete: "set null" },
  ),
  transcript: text("transcript").notNull().default(""),
  summary: jsonb("summary").notNull().default({}),
  retentionUntil: timestamp("retention_until", { withTimezone: true }),
  errorCode: text("error_code"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  ...timestamps,
});

export const meetingTranscriptSegments = pgTable(
  "meeting_transcript_segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    startMs: integer("start_ms").notNull(),
    endMs: integer("end_ms").notNull(),
    speaker: text("speaker"),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("meeting_segment_position_unique").on(
      table.meetingId,
      table.position,
    ),
  ],
);

export const instanceSettings = pgTable("instance_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  storageProvider: text("storage_provider").notNull().default("local"),
  storageConfig: jsonb("storage_config").notNull().default({}),
  smtpConfig: jsonb("smtp_config").notNull().default({}),
  pushConfig: jsonb("push_config").notNull().default({}),
  meetingRetentionDays: integer("meeting_retention_days").notNull().default(30),
  maxAttachmentBytes: integer("max_attachment_bytes")
    .notNull()
    .default(104857600),
  updateChecksEnabled: boolean("update_checks_enabled")
    .notNull()
    .default(false),
  ...timestamps,
});

export const activityEvents = pgTable("activity_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id, {
    onDelete: "set null",
  }),
  actorType: text("actor_type").notNull().default("user"),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  action: text("action").notNull(),
  payload: jsonb("payload").notNull().default({}),
  undoPayload: jsonb("undo_payload"),
  undoneAt: timestamp("undone_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const automationRuns = pgTable("automation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  automationId: uuid("automation_id")
    .notNull()
    .references(() => automations.id, { onDelete: "cascade" }),
  triggerEventId: uuid("trigger_event_id").references(() => activityEvents.id, {
    onDelete: "set null",
  }),
  status: jobStatusEnum("status").notNull().default("queued"),
  input: jsonb("input").notNull().default({}),
  output: jsonb("output").notNull().default({}),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const aiProviderConfigs = pgTable("ai_provider_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  name: text("name").notNull(),
  endpoint: text("endpoint"),
  encryptedSecret: text("encrypted_secret"),
  models: jsonb("models").notNull().default([]),
  enabled: boolean("enabled").notNull().default(true),
  ...timestamps,
});

export const aiPolicies = pgTable("ai_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  maxAutonomy: autonomyEnum("max_autonomy").notNull().default("suggest"),
  monthlyTokenBudget: integer("monthly_token_budget"),
  maxTokensPerRun: integer("max_tokens_per_run").notNull().default(12000),
  allowedProjectIds: jsonb("allowed_project_ids").notNull().default([]),
  allowedActions: jsonb("allowed_actions").notNull().default([]),
  ...timestamps,
});

export const aiRuns = pgTable("ai_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  requestedBy: uuid("requested_by")
    .notNull()
    .references(() => users.id),
  providerConfigId: uuid("provider_config_id")
    .notNull()
    .references(() => aiProviderConfigs.id),
  model: text("model").notNull(),
  autonomy: autonomyEnum("autonomy").notNull(),
  status: aiRunStatusEnum("status").notNull().default("queued"),
  prompt: text("prompt").notNull(),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  estimatedCostMicros: integer("estimated_cost_micros"),
  errorCode: text("error_code"),
  ...timestamps,
});

export const aiProposals = pgTable("ai_proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => aiRuns.id, { onDelete: "cascade" }),
  summary: text("summary").notNull().default(""),
  operations: jsonb("operations").notNull(),
  selectedOperationIds: jsonb("selected_operation_ids").notNull().default([]),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  ...timestamps,
});

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  status: jobStatusEnum("status").notNull().default("queued"),
  payload: jsonb("payload").notNull(),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lockedBy: text("locked_by"),
  lastError: text("last_error"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
});

export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    response: jsonb("response").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idempotency_workspace_key_unique").on(
      table.workspaceId,
      table.key,
    ),
  ],
);
