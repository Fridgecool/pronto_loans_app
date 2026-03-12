import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserByEmployeeNumber, sanitizeUser } from "@/lib/users";
export const runtime = "nodejs";

export async function GET(request: Request) {
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
  if (session.mustChangePassword) {
    return NextResponse.json(
      { error: "Password change required." },
      { status: 403 }
    );
  }

  const user = await getUserByEmployeeNumber(session.employeeNumber);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ user: sanitizeUser(user) });
}
