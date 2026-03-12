import { NextResponse } from "next/server";
import { getEmployers } from "@/lib/employers";

export const runtime = "nodejs";

export async function GET() {
  const employers = await getEmployers();
  return NextResponse.json({ employers });
}
