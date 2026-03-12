import fs from "fs/promises";
import path from "path";

export const dataDir = path.join(process.cwd(), "data");

export async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson<T>(filePath: string, data: T) {
  const json = JSON.stringify(data, null, 2);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, json, "utf-8");
}
