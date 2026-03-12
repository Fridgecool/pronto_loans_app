import { NextResponse } from "next/server";
import { getUserByEmployeeNumber } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const employeeNumber = String(body?.employeeNumber ?? "").trim();
  if (!employeeNumber) {
    return NextResponse.json({ error: "Employee number is required." }, { status: 400 });
  }
  const user = await getUserByEmployeeNumber(employeeNumber);
  if (!user) {
    return NextResponse.json(
      {
        error:
          "Employee number not found. Please contact Pronto Loans for assistance.",
      },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
