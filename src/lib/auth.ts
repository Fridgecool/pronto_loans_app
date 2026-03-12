import path from "path";
import crypto from "crypto";
import { readJson, writeJson } from "./storage";

type SessionRecord = {
  token: string;
  employeeNumber: string;
  expiresAt: string;
  mustChangePassword: boolean;
};

type SessionsFile = {
  sessions: SessionRecord[];
};

const sessionsPath = path.join(process.cwd(), "data", "sessions.json");
const SESSION_TTL_HOURS = 24;

export async function createSession(
  employeeNumber: string,
  options?: { mustChangePassword?: boolean }
) {
  const data = await readJson<SessionsFile>(sessionsPath, { sessions: [] });
  const token = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000
  ).toISOString();
  data.sessions.push({
    token,
    employeeNumber,
    expiresAt,
    mustChangePassword: !!options?.mustChangePassword,
  });
  await writeJson(sessionsPath, data);
  return token;
}

export async function getSession(token: string) {
  const data = await readJson<SessionsFile>(sessionsPath, { sessions: [] });
  const now = Date.now();
  const activeSessions = data.sessions
    .map((session) => ({
      ...session,
      mustChangePassword: !!session.mustChangePassword,
    }))
    .filter(
    (session) => new Date(session.expiresAt).getTime() > now
  );
  if (activeSessions.length !== data.sessions.length) {
    await writeJson(sessionsPath, { sessions: activeSessions });
  }
  return activeSessions.find((session) => session.token === token);
}
export async function setSessionMustChangePassword(
  token: string,
  mustChangePassword: boolean
) {
  const data = await readJson<SessionsFile>(sessionsPath, { sessions: [] });
  let updated = false;
  const nextSessions = data.sessions.map((session) => {
    if (session.token !== token) return session;
    updated = true;
    return { ...session, mustChangePassword };
  });
  if (updated) {
    await writeJson(sessionsPath, { sessions: nextSessions });
  }
}

export async function deleteSession(token: string) {
  const data = await readJson<SessionsFile>(sessionsPath, { sessions: [] });
  const nextSessions = data.sessions.filter(
    (session) => session.token !== token
  );
  await writeJson(sessionsPath, { sessions: nextSessions });
}
