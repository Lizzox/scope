import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(
  /* turbopackIgnore: true */ process.env.SCOPE_UPLOAD_DIR || "/data/uploads",
);

export function safeDownloadName(name: string) {
  return name.replace(/[\r\n"\\/]/g, "_").slice(0, 240) || "download";
}
export async function storeLocalFile(data: Uint8Array) {
  await mkdir(root, { recursive: true });
  const objectKey = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}`;
  const target = path.resolve(root, objectKey);
  if (!target.startsWith(`${root}${path.sep}`))
    throw new Error("invalid_storage_path");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data, { flag: "wx" });
  return { objectKey, sha256: createHash("sha256").update(data).digest("hex") };
}
export async function readLocalFile(objectKey: string) {
  const target = path.resolve(root, objectKey);
  if (!target.startsWith(`${root}${path.sep}`))
    throw new Error("invalid_storage_path");
  return readFile(/* turbopackIgnore: true */ target);
}
export async function deleteLocalFile(objectKey: string) {
  const target = path.resolve(root, objectKey);
  if (!target.startsWith(`${root}${path.sep}`))
    throw new Error("invalid_storage_path");
  await rm(/* turbopackIgnore: true */ target, { force: true });
}
