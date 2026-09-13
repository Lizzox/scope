import { createDecipheriv } from "node:crypto";
import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
} from "discord.js";
import {
  EndBehaviorType,
  entersState,
  joinVoiceChannel,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import prism from "prism-media";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const sql = postgres(databaseUrl, { max: 4 });
const clients = new Map();

function decrypt(payload) {
  const key = Buffer.from(process.env.SCOPE_ENCRYPTION_KEY || "", "base64");
  if (key.length !== 32) throw new Error("SCOPE_ENCRYPTION_KEY is invalid");
  const [version, iv, tag, encrypted] = payload.split(".");
  if (version !== "v1") throw new Error("Unsupported secret format");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function wav(pcm) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(48_000, 24);
  header.writeUInt32LE(48_000 * 2 * 2, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function transcribe(bytes) {
  const endpoint = process.env.SCOPE_TRANSCRIBER_URL;
  if (!endpoint) throw new Error("transcriber_not_configured");
  const body = new FormData();
  const local = process.env.SCOPE_TRANSCRIBER_FORMAT === "whisper-asr";
  body.append(
    local ? "audio_file" : "file",
    new Blob([bytes], { type: "audio/wav" }),
    "discord.wav",
  );
  if (!local)
    body.append("model", process.env.SCOPE_TRANSCRIBER_MODEL || "whisper-1");
  const response = await fetch(
    local
      ? `${endpoint.replace(/\/$/, "")}/asr?output=json`
      : `${endpoint.replace(/\/$/, "")}/v1/audio/transcriptions`,
    {
      method: "POST",
      headers: process.env.SCOPE_TRANSCRIBER_API_KEY
        ? { authorization: `Bearer ${process.env.SCOPE_TRANSCRIBER_API_KEY}` }
        : undefined,
      body,
    },
  );
  if (!response.ok) throw new Error(`transcriber_http_${response.status}`);
  const payload = await response.json();
  if (typeof payload.text !== "string" || !payload.text.trim())
    throw new Error("transcriber_invalid_response");
  return payload.text.trim();
}

async function startClient(integration) {
  const { botToken } = JSON.parse(decrypt(integration.encrypted_credentials));
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });
  const sessions = new Map();
  client.once("ready", async () => {
    await client.application.commands.set([
      new SlashCommandBuilder()
        .setName("scope-start")
        .setDescription("Scope Capture in deinem aktuellen Voice-Channel starten")
        .addStringOption((option) =>
          option
            .setName("title")
            .setDescription("Titel des Meetings")
            .setRequired(true),
        )
        .addBooleanOption((option) =>
          option
            .setName("consent")
            .setDescription("Alle Teilnehmenden haben der Aufnahme zugestimmt")
            .setRequired(true),
        ),
      new SlashCommandBuilder()
        .setName("scope-stop")
        .setDescription("Scope Capture beenden und transkribieren"),
    ]);
    await sql`update meeting_integrations set last_connected_at=now(), last_error=null, updated_at=now() where id=${integration.id}`;
    console.log(`Scope Discord bot ${client.user.tag} connected.`);
  });
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    if (interaction.commandName === "scope-start") {
      if (!interaction.options.getBoolean("consent", true)) {
        await interaction.reply({
          content: "Scope Capture startet nur nach Zustimmung aller Teilnehmenden.",
          ephemeral: true,
        });
        return;
      }
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const channel = member.voice.channel;
      if (!channel) {
        await interaction.reply({
          content: "Bitte tritt zuerst einem Voice-Channel bei.",
          ephemeral: true,
        });
        return;
      }
      if (sessions.has(interaction.guildId)) {
        await interaction.reply({ content: "Scope Capture läuft bereits.", ephemeral: true });
        return;
      }
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: interaction.guildId,
        adapterCreator: interaction.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: true,
      });
      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
      } catch {
        connection.destroy();
        await interaction.reply({
          content: "Scope konnte dem Voice-Channel nicht beitreten. Prüfe die Bot-Berechtigungen.",
          ephemeral: true,
        });
        return;
      }
      const session = {
        connection,
        title: interaction.options.getString("title", true),
        startedAt: Date.now(),
        segments: [],
      };
      sessions.set(interaction.guildId, session);
      connection.receiver.speaking.on("start", async (userId) => {
        const startedAt = Date.now();
        const chunks = [];
        const decoder = new prism.opus.Decoder({
          rate: 48_000,
          channels: 2,
          frameSize: 960,
        });
        const stream = connection.receiver.subscribe(userId, {
          end: { behavior: EndBehaviorType.AfterSilence, duration: 500 },
        });
        stream.pipe(decoder);
        decoder.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        decoder.once("end", async () => {
          if (!chunks.length) return;
          const user = await client.users.fetch(userId).catch(() => null);
          session.segments.push({
            startedAt,
            speaker: user?.displayName ?? user?.username ?? "Teilnehmer",
            pcm: Buffer.concat(chunks),
          });
        });
      });
      await interaction.reply(
        "🔴 Scope Capture ist beigetreten. Alle Teilnehmenden wurden über die Aufnahme informiert. Nutze `/scope-stop` zum Beenden.",
      );
      return;
    }
    if (interaction.commandName === "scope-stop") {
      const session = sessions.get(interaction.guildId);
      if (!session) {
        await interaction.reply({ content: "Keine Scope-Aufnahme aktiv.", ephemeral: true });
        return;
      }
      await interaction.deferReply();
      sessions.delete(interaction.guildId);
      session.connection.destroy();
      await new Promise((resolve) => setTimeout(resolve, 700));
      try {
        const ordered = session.segments.sort((a, b) => a.startedAt - b.startedAt);
        const lines = [];
        for (const segment of ordered) {
          const text = await transcribe(wav(segment.pcm));
          lines.push(`${segment.speaker}: ${text}`);
        }
        if (!lines.length) throw new Error("discord_audio_empty");
        const [meeting] = await sql`
          insert into meetings (
            workspace_id, project_id, title, source, status, language,
            consent_confirmed_at, consent_confirmed_by, transcript,
            retention_until, created_by
          ) values (
            ${integration.workspace_id}, ${integration.project_id}, ${session.title},
            'discord', 'uploaded', 'auto', now(), ${integration.created_by},
            ${lines.join("\n")}, now() + interval '30 days', ${integration.created_by}
          ) returning id
        `;
        await interaction.editReply(
          `✅ Transkript wurde als Scope Meeting gespeichert (${meeting.id.slice(0, 8)}).`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "capture_failed";
        await sql`update meeting_integrations set last_error=${message.slice(0, 200)}, updated_at=now() where id=${integration.id}`;
        await interaction.editReply("Die Aufnahme konnte nicht transkribiert werden. Prüfe Scope unter Meetings.");
      }
    }
  });
  client.on("error", (error) => console.error("Discord client error", error.message));
  await client.login(botToken);
  clients.set(integration.id, client);
}

async function reconcile() {
  const integrations = await sql`
    select * from meeting_integrations
    where provider='discord' and enabled=true
  `;
  for (const integration of integrations) {
    if (clients.has(integration.id)) continue;
    try {
      await startClient(integration);
    } catch (error) {
      const message = error instanceof Error ? error.message : "discord_login_failed";
      await sql`update meeting_integrations set last_error=${message.slice(0, 200)}, updated_at=now() where id=${integration.id}`;
      console.error("Discord integration failed", integration.id, message);
    }
  }
}

console.log("Scope Discord bot runner started.");
await reconcile();
setInterval(() => void reconcile(), 30_000);

async function shutdown() {
  for (const client of clients.values()) client.destroy();
  await sql.end({ timeout: 5 });
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
