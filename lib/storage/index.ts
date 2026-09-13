import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getDb } from "@/lib/db/client";
import { instanceSettings } from "@/lib/db/schema";
import { deleteLocalFile, readLocalFile, storeLocalFile } from "./local";

function s3Config() {
  const bucket = process.env.SCOPE_S3_BUCKET;
  if (!bucket) throw new Error("SCOPE_S3_BUCKET is required for S3 storage");
  return { bucket, client: new S3Client({ region: process.env.SCOPE_S3_REGION || "us-east-1", endpoint: process.env.SCOPE_S3_ENDPOINT || undefined, forcePathStyle: process.env.SCOPE_S3_FORCE_PATH_STYLE === "true", credentials: process.env.SCOPE_S3_ACCESS_KEY && process.env.SCOPE_S3_SECRET_KEY ? { accessKeyId: process.env.SCOPE_S3_ACCESS_KEY, secretAccessKey: process.env.SCOPE_S3_SECRET_KEY } : undefined }) };
}
async function configuredProvider() { const [settings] = await getDb().select({ provider: instanceSettings.storageProvider }).from(instanceSettings).limit(1); return settings?.provider ?? "local"; }
export async function storeFile(data: Uint8Array) {
  const provider = await configuredProvider();
  if (provider !== "s3") return { ...(await storeLocalFile(data)), storageProvider: "local" };
  const { bucket, client } = s3Config(); const objectKey = `scope/${new Date().toISOString().slice(0, 7)}/${randomUUID()}`; await client.send(new PutObjectCommand({ Bucket: bucket, Key: objectKey, Body: data })); return { objectKey, sha256: createHash("sha256").update(data).digest("hex"), storageProvider: "s3" };
}
export async function readStoredFile(provider: string, objectKey: string) { if (provider !== "s3") return readLocalFile(objectKey); const { bucket, client } = s3Config(); const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey })); if (!result.Body) throw new Error("s3_object_empty"); return new Uint8Array(await result.Body.transformToByteArray()); }
export async function deleteStoredFile(provider: string, objectKey: string) { if (provider !== "s3") return deleteLocalFile(objectKey); const { bucket, client } = s3Config(); await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey })); }
