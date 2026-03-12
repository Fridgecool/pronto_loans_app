import { NextResponse } from "next/server";
import { getSession, setSessionMustChangePassword } from "@/lib/auth";
import { updateUserPassword } from "@/lib/users";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

function isValidPassword(password: string) {
  if (password.length < 6 || password.length > 20) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

export async function POST(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .find((cookie) => cookie.trim().startsWith("session_token="))
    ?.split("=")[1];

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await getSession(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const newPassword = String(body?.newPassword ?? "");
  if (!isValidPassword(newPassword)) {
    return NextResponse.json(
      {
        error:
          "Password must be 6-20 characters and include at least 1 uppercase letter and 1 number.",
      },
      { status: 400 }
    );
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await updateUserPassword(session.employeeNumber, hash);
  await setSessionMustChangePassword(token, false);

  return NextResponse.json({ ok: true });
}
