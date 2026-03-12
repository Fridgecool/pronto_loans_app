import path from "path";
import fs from "fs/promises";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 2 * 1024 * 1024;

async function getSessionEmployee(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .find((cookie) => cookie.trim().startsWith("session_token="))
    ?.split("=")[1];

  if (!token) return null;
  const session = await getSession(token);
  if (!session || session.mustChangePassword) return null;
  return session.employeeNumber;
}

export async function POST(request: Request) {
  const employeeNumber = await getSessionEmployee(request);
  if (!employeeNumber) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const payslip = formData.get("payslip");
  const bankStatement = formData.get("bankStatement");

  if (!(payslip instanceof File) || !(bankStatement instanceof File)) {
    return NextResponse.json(
      { error: "Payslip and bank statement are required." },
      { status: 400 }
    );
  }

  if (payslip.size > MAX_FILE_SIZE || bankStatement.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File size exceeds 2MB limit." },
      { status: 400 }
    );
  }

  const uploadsDir = path.join(process.cwd(), "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });

  const payslipExt = path.extname(payslip.name) || ".file";
  const bankExt = path.extname(bankStatement.name) || ".file";

  const payslipName = `${employeeNumber}-${Date.now()}-payslip${payslipExt}`;
  const bankName = `${employeeNumber}-${Date.now()}-bank${bankExt}`;

  const payslipPath = path.join(uploadsDir, payslipName);
  const bankPath = path.join(uploadsDir, bankName);

  await fs.writeFile(
    payslipPath,
    Buffer.from(await payslip.arrayBuffer())
  );
  await fs.writeFile(
    bankPath,
    Buffer.from(await bankStatement.arrayBuffer())
  );

  return NextResponse.json({
    payslip: payslipName,
    bankStatement: bankName,
  });
}
