import { NextResponse } from "next/server";
import {
  getUserByEmployeeNumber,
  sanitizeUser,
  verifyPassword,
} from "@/lib/users";
import { createSession } from "@/lib/auth";
import { clearFailures, getAttemptStatus, recordFailure } from "@/lib/loginAttempts";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.employeeNumber || !body?.password) {
    return NextResponse.json(
      { error: "Employee number and password are required." },
      { status: 400 }
    );
  }

  const user = await getUserByEmployeeNumber(body.employeeNumber);
  if (!user) {
    await recordFailure(body.employeeNumber);
    return NextResponse.json(
      {
        error:
          "Employee number not found. Please contact Pronto Loans for assistance.",
      },
      { status: 401 }
    );
  }
  const attemptStatus = await getAttemptStatus(user.employeeNumber);
  if (attemptStatus.locked) {
    return NextResponse.json(
      { error: "Account locked. Try again later." },
      { status: 429 }
    );
  }

  const passwordOk = await verifyPassword(user, body.password);
  if (!passwordOk) {
    await recordFailure(user.employeeNumber);
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }
  await clearFailures(user.employeeNumber);
  const mustChangePassword = body.password === user.employeeNumber;
  const token = await createSession(user.employeeNumber, { mustChangePassword });
  const response = NextResponse.json({
    user: sanitizeUser(user),
    mustChangePassword,
  });
  response.cookies.set({
    name: "session_token",
    value: token,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return response;
}
