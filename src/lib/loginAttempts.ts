import path from "path";
import { readJson, writeJson } from "./storage";

type AttemptRecord = {
  count: number;
  lockUntil?: string;
};

type AttemptsFile = {
  attempts: Record<string, AttemptRecord>;
};

const attemptsPath = path.join(process.cwd(), "data", "login_attempts.json");
const MAX_ATTEMPTS = 3;
const LOCK_MINUTES = 60;

export async function getAttemptStatus(employeeNumber: string) {
  const data = await readJson<AttemptsFile>(attemptsPath, { attempts: {} });
  const record = data.attempts[employeeNumber] ?? { count: 0 };
  const now = Date.now();
  const lockUntil = record.lockUntil
    ? new Date(record.lockUntil).getTime()
    : 0;
  const locked = lockUntil > now;
  return { ...record, locked, lockUntil };
}

export async function recordFailure(employeeNumber: string) {
  const data = await readJson<AttemptsFile>(attemptsPath, { attempts: {} });
  const current = data.attempts[employeeNumber] ?? { count: 0 };
  const nextCount = current.count + 1;
  const record: AttemptRecord = { count: nextCount };
  if (nextCount >= MAX_ATTEMPTS) {
    const lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
    record.count = 0;
    record.lockUntil = lockUntil;
  }
  data.attempts[employeeNumber] = record;
  await writeJson(attemptsPath, data);
  return record;
}

export async function clearFailures(employeeNumber: string) {
  const data = await readJson<AttemptsFile>(attemptsPath, { attempts: {} });
  if (data.attempts[employeeNumber]) {
    delete data.attempts[employeeNumber];
    await writeJson(attemptsPath, data);
  }
}
