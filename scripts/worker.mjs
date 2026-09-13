import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DATABASE_URL is required for the Scope worker");
const sql = postgres(databaseUrl, {
  max: 4,
  idle_timeout: 20,
  onnotice: () => {},
});
const workerId = `scope-${process.pid}-${randomUUID().slice(0, 8)}`;
let stopping = false;

function nextOccurrence(rule, from) {
  const next = new Date(from);
  const interval = Math.max(1, rule.interval || 1);
  if (rule.frequency === "daily") next.setUTCDate(next.getUTCDate() + interval);
  else if (rule.frequency === "weekly")
    next.setUTCDate(next.getUTCDate() + interval * 7);
  else if (rule.frequency === "monthly")
    next.setUTCMonth(next.getUTCMonth() + interval);
  else next.setUTCFullYear(next.getUTCFullYear() + interval);
  return next;
}

async function createRecurringTask(job) {
  const ruleId = job.payload.ruleId;
  const [rule] = await sql`select * from recurrence_rules where id=${ruleId}`;
  if (!rule || !rule.active) return { skipped: "inactive" };
  const occurrence = new Date(rule.next_occurrence_at);
  if (rule.ends_at && occurrence > new Date(rule.ends_at)) {
    await sql`update recurrence_rules set active=false, updated_at=now() where id=${rule.id}`;
    return { skipped: "ended" };
  }
  const template = rule.task_template || {};
  const result = await sql.begin(async (tx) => {
    const existing =
      await tx`select id from tasks where recurrence_rule_id=${rule.id} and recurrence_occurrence_at=${occurrence} limit 1`;
    if (existing.length) return { taskId: existing[0].id, duplicate: true };
    const [project] =
      await tx`select workspace_id from projects where id=${rule.project_id}`;
    if (!project) return { skipped: "project_missing" };
    const [counter] =
      await tx`update workspaces set next_task_number=next_task_number+1, updated_at=now() where id=${project.workspace_id} returning next_task_number-1 as number`;
    const dueDate = new Date(
      occurrence.getTime() + Number(template.dueOffsetDays || 0) * 86400000,
    );
    const [task] =
      await tx`insert into tasks (project_id, milestone_id, recurrence_rule_id, recurrence_occurrence_at, number, title, description, status, priority, position, assignee_id, due_date, created_by) values (${rule.project_id}, ${template.milestoneId || null}, ${rule.id}, ${occurrence}, ${counter.number}, ${template.title || "Wiederkehrende Aufgabe"}, ${template.description || ""}, ${template.status || "backlog"}, ${template.priority || "medium"}, ${counter.number}, ${template.assigneeId || null}, ${dueDate}, ${rule.created_by}) returning id`;
    for (const labelId of template.labelIds || [])
      await tx`insert into task_labels (task_id,label_id) values (${task.id},${labelId}) on conflict do nothing`;
    await tx`insert into activity_events (workspace_id,actor_id,actor_type,entity_type,entity_id,action,payload) values (${project.workspace_id},${rule.created_by},'automation','task',${task.id},'task.recurring_created',${tx.json({ ruleId: rule.id, occurrence: occurrence.toISOString() })})`;
    return { taskId: task.id };
  });
  const next = nextOccurrence(rule, occurrence);
  await sql`update recurrence_rules set next_occurrence_at=${next}, updated_at=now() where id=${rule.id}`;
  if (!rule.ends_at || next <= new Date(rule.ends_at))
    await sql`insert into jobs (type,status,payload,run_at,max_attempts,attempts) values ('recurrence.generate','queued',${sql.json({ ruleId: rule.id })},${next},3,0)`;
  return { ...result, next: next.toISOString() };
}

function conditionsMatch(conditions, event) {
  const payload = event.payload || {};
  return (conditions || []).every((condition) => {
    const value = condition.field
      .split(".")
      .reduce((current, key) => current?.[key], { event, payload });
    if (condition.operator === "eq") return value === condition.value;
    if (condition.operator === "neq") return value !== condition.value;
    if (condition.operator === "contains")
      return Array.isArray(value)
        ? value.includes(condition.value)
        : String(value || "").includes(String(condition.value));
    if (condition.operator === "in")
      return Array.isArray(condition.value) && condition.value.includes(value);
    return true;
  });
}

async function dispatchAutomation(job) {
  const [event] =
    await sql`select * from activity_events where id=${job.payload.eventId}`;
  if (!event) return { skipped: "event_missing" };
  const rules =
    await sql`select * from automations where workspace_id=${event.workspace_id} and status='active'`;
  let queued = 0;
  for (const rule of rules) {
    if (
      rule.trigger?.type !== event.action &&
      rule.trigger?.type !== `${event.entity_type}.${event.action}`
    )
      continue;
    if (!conditionsMatch(rule.conditions, event)) continue;
    const [run] =
      await sql`insert into automation_runs (automation_id,trigger_event_id,status,input) values (${rule.id},${event.id},'queued',${sql.json({ eventId: event.id })}) returning id`;
    await sql`insert into jobs (type,status,payload,run_at,max_attempts,attempts) values ('automation.execute','queued',${sql.json({ automationRunId: run.id })},now(),3,0)`;
    queued++;
  }
  return { queued };
}

async function executeAutomation(job) {
  const [run] =
    await sql`select ar.*, a.* from automation_runs ar join automations a on a.id=ar.automation_id where ar.id=${job.payload.automationRunId}`;
  if (!run) return { skipped: "run_missing" };
  const [event] = run.trigger_event_id
    ? await sql`select * from activity_events where id=${run.trigger_event_id}`
    : [];
  const output = [];
  for (const action of (run.actions || []).slice(0, 10)) {
    if (action.type === "notification.send") {
      const userId = action.config?.userId || event?.actor_id || run.created_by;
      const [notification] =
        await sql`insert into notifications (workspace_id,user_id,actor_id,type,title,body,entity_type,entity_id,data) values (${run.workspace_id},${userId},${run.created_by},'automation',${action.config?.title || run.name},${action.config?.body || run.description || "Automation ausgeführt"},${event?.entity_type || null},${event?.entity_id || null},${sql.json({ automationId: run.automation_id })}) returning id`;
      await sql`insert into jobs (type,status,payload,run_at,max_attempts,attempts) values ('notification.deliver','queued',${sql.json({ notificationId: notification.id })},now(),3,0)`;
      output.push({ action: action.type, notificationId: notification.id });
    } else if (action.type === "task.update" && event?.entity_type === "task") {
      const allowed = Object.fromEntries(
        Object.entries(action.config || {}).filter(([key]) =>
          ["status", "priority", "assignee_id", "due_date"].includes(key),
        ),
      );
      if (Object.keys(allowed).length) {
        await sql`update tasks set ${sql(allowed)}, version=version+1, updated_at=now() where id=${event.entity_id}`;
        output.push({ action: action.type, taskId: event.entity_id });
      }
    }
  }
  await sql`update automation_runs set status='completed', output=${sql.json(output)}, completed_at=now() where id=${job.payload.automationRunId}`;
  await sql`update automations set last_run_at=now(), updated_at=now() where id=${run.automation_id}`;
  return { output };
}

async function deliverNotification(job) {
  const [record] =
    await sql`select n.*, u.email, coalesce(np.channels, '{"inApp":true,"email":false,"push":false}'::jsonb) as channels, coalesce(np.digest, 'instant') as digest from notifications n join users u on u.id=n.user_id left join notification_preferences np on np.user_id=n.user_id and np.workspace_id=n.workspace_id where n.id=${job.payload.notificationId}`;
  if (!record) return { skipped: "notification_missing" };
  if (record.digest === "off") return { skipped: "delivery_paused" };
  const delivered = [];
  if (record.channels?.email && process.env.SCOPE_SMTP_HOST) {
    const nodemailer = (await import("nodemailer")).default;
    const transport = nodemailer.createTransport({
      host: process.env.SCOPE_SMTP_HOST,
      port: Number(process.env.SCOPE_SMTP_PORT || 587),
      secure: process.env.SCOPE_SMTP_SECURE === "true",
      auth: process.env.SCOPE_SMTP_USER
        ? {
            user: process.env.SCOPE_SMTP_USER,
            pass: process.env.SCOPE_SMTP_PASSWORD,
          }
        : undefined,
    });
    await transport.sendMail({
      from: process.env.SCOPE_SMTP_FROM || "Scope <scope@localhost>",
      to: record.email,
      subject: record.title,
      text: `${record.body}\n\n${process.env.NEXT_PUBLIC_APP_URL || ""}`,
    });
    delivered.push("email");
  }
  if (
    record.channels?.push &&
    process.env.SCOPE_VAPID_PUBLIC_KEY &&
    process.env.SCOPE_VAPID_PRIVATE_KEY
  ) {
    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(
      process.env.SCOPE_VAPID_SUBJECT || "mailto:admin@localhost",
      process.env.SCOPE_VAPID_PUBLIC_KEY,
      process.env.SCOPE_VAPID_PRIVATE_KEY,
    );
    const subscriptions =
      await sql`select subscription from push_subscriptions where user_id=${record.user_id}`;
    for (const item of subscriptions) {
      try {
        await webpush.sendNotification(
          item.subscription,
          JSON.stringify({
            title: record.title,
            body: record.body,
            data: record.data,
          }),
        );
        delivered.push("push");
      } catch (error) {
        if (error?.statusCode === 404 || error?.statusCode === 410)
          await sql`delete from push_subscriptions where subscription=${sql.json(item.subscription)}`;
        else throw error;
      }
    }
  }
  return { delivered };
}

async function transcribeMeeting(job) {
  const meetingId = job.payload.meetingId;
  const [record] =
    await sql`select m.*, a.object_key, a.original_name, a.mime_type, a.storage_provider from meetings m join attachments a on a.id=m.recording_attachment_id where m.id=${meetingId} and a.status='ready'`;
  if (!record) throw new Error("meeting_recording_missing");
  const endpoint = process.env.SCOPE_TRANSCRIBER_URL;
  if (!endpoint) {
    await sql`update meetings set status='failed', error_code='transcriber_not_configured', updated_at=now() where id=${meetingId}`;
    throw new Error("transcriber_not_configured");
  }
  try {
    let bytes;
    if (record.storage_provider === "s3") {
      const client = new S3Client({
        region: process.env.SCOPE_S3_REGION || "us-east-1",
        endpoint: process.env.SCOPE_S3_ENDPOINT || undefined,
        forcePathStyle: process.env.SCOPE_S3_FORCE_PATH_STYLE === "true",
        credentials:
          process.env.SCOPE_S3_ACCESS_KEY && process.env.SCOPE_S3_SECRET_KEY
            ? {
                accessKeyId: process.env.SCOPE_S3_ACCESS_KEY,
                secretAccessKey: process.env.SCOPE_S3_SECRET_KEY,
              }
            : undefined,
      });
      const object = await client.send(
        new GetObjectCommand({
          Bucket: process.env.SCOPE_S3_BUCKET,
          Key: record.object_key,
        }),
      );
      bytes = new Uint8Array(await object.Body.transformToByteArray());
    } else {
      const root = path.resolve(
        process.env.SCOPE_UPLOAD_DIR || "/data/uploads",
      );
      const target = path.resolve(root, record.object_key);
      if (!target.startsWith(`${root}${path.sep}`))
        throw new Error("invalid_storage_path");
      bytes = await readFile(target);
    }
    const body = new FormData();
    const whisperAsr = process.env.SCOPE_TRANSCRIBER_FORMAT === "whisper-asr";
    body.append(
      whisperAsr ? "audio_file" : "file",
      new Blob([bytes], { type: record.mime_type }),
      record.original_name,
    );
    if (!whisperAsr)
      body.append("model", process.env.SCOPE_TRANSCRIBER_MODEL || "whisper-1");
    if (record.language && record.language !== "auto")
      body.append("language", record.language);
    const headers = process.env.SCOPE_TRANSCRIBER_API_KEY
      ? { authorization: `Bearer ${process.env.SCOPE_TRANSCRIBER_API_KEY}` }
      : undefined;
    const targetUrl = whisperAsr
      ? `${endpoint.replace(/\/$/, "")}/asr?output=json`
      : `${endpoint.replace(/\/$/, "")}/v1/audio/transcriptions`;
    const response = await fetch(targetUrl, { method: "POST", headers, body });
    if (!response.ok) throw new Error(`transcriber_http_${response.status}`);
    const payload = await response.json();
    const transcript = typeof payload.text === "string" ? payload.text : "";
    if (!transcript) throw new Error("transcriber_invalid_response");
    await sql`update meetings set transcript=${transcript}, status='uploaded', error_code=null, updated_at=now() where id=${meetingId}`;
    return { characters: transcript.length };
  } catch (error) {
    const code =
      error instanceof Error
        ? error.message.slice(0, 120)
        : "transcription_failed";
    await sql`update meetings set status='failed', error_code=${code}, updated_at=now() where id=${meetingId}`;
    throw error;
  }
}

async function processJob(job) {
  if (job.type === "recurrence.generate") return createRecurringTask(job);
  if (job.type === "automation.dispatch") return dispatchAutomation(job);
  if (job.type === "automation.execute") return executeAutomation(job);
  if (job.type === "meeting.transcribe") return transcribeMeeting(job);
  if (job.type === "notification.deliver") return deliverNotification(job);
  return { skipped: "unsupported_job" };
}

async function claim() {
  return sql.begin(async (tx) => {
    const rows =
      await tx`select * from jobs where status='queued' and run_at<=now() order by run_at for update skip locked limit 1`;
    if (!rows.length) return null;
    const [job] =
      await tx`update jobs set status='running', locked_at=now(), locked_by=${workerId}, attempts=attempts+1, updated_at=now() where id=${rows[0].id} returning *`;
    return job;
  });
}

async function tick() {
  const job = await claim();
  if (!job) return false;
  try {
    const result = await processJob(job);
    await sql`update jobs set status='completed', completed_at=now(), last_error=null, updated_at=now(), payload=${sql.json({ ...job.payload, result })} where id=${job.id}`;
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 1000) : "unknown";
    if (job.attempts < job.max_attempts)
      await sql`update jobs set status='queued', run_at=now()+interval '10 seconds', locked_at=null, locked_by=null, last_error=${message}, updated_at=now() where id=${job.id}`;
    else
      await sql`update jobs set status='failed', last_error=${message}, updated_at=now() where id=${job.id}`;
  }
  return true;
}

process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
console.log(`Scope worker ${workerId} started.`);
while (!stopping) {
  const worked = await tick();
  if (!worked) await new Promise((resolve) => setTimeout(resolve, 1500));
}
await sql.end();
