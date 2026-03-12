import path from "path";
import fs from "fs/promises";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendApplicationEmail, type EmailResult } from "@/lib/email";
import { generateApplicationPDF } from "@/lib/pdfGenerator";
import { getUserByEmployeeNumber } from "@/lib/users";

export const runtime = "nodejs";

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
  try {
    const employeeNumber = await getSessionEmployee(request);
    if (!employeeNumber) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);
    if (!payload) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const submittedAt = new Date().toISOString();
    const baseUrl = new URL(request.url).origin;
    const payslipName = payload?.uploadResult?.payslip;
    const bankName = payload?.uploadResult?.bankStatement;
    const storedUser = await getUserByEmployeeNumber(employeeNumber);
    const idDocName = storedUser?.idDocumentFile;
    const fileLinks =
      payslipName && bankName
        ? {
            payslip: `${baseUrl}/api/files/${encodeURIComponent(payslipName)}`,
            bankStatement: `${baseUrl}/api/files/${encodeURIComponent(bankName)}`,
            idDocument: idDocName
              ? `${baseUrl}/api/files/${encodeURIComponent(idDocName)}`
              : undefined,
          }
        : null;
    const record = {
      ...payload,
      fileLinks,
      employeeNumber,
      submittedAt,
    };

    const fileName = `application-${employeeNumber}-${Date.now()}.json`;
    const filePath = path.join(process.cwd(), "data", "applications", fileName);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(record, null, 2), "utf-8");

    const pdfBuffer = await generateApplicationPDF(record);
    const pdfName = fileName.replace(".json", ".pdf");
    const pdfPath = path.join(process.cwd(), "data", "applications", pdfName);
    await fs.writeFile(pdfPath, pdfBuffer);

    const smtpTo = "info@prontoloans.co.za";
    let emailStatus: EmailResult = {
      sent: false,
      skipped: true,
      reason: "No recipient set.",
    };
    if (smtpTo) {
      emailStatus = await sendApplicationEmail(
        smtpTo,
        "Pronto Loan Application",
        JSON.stringify(record, null, 2),
        [{ filename: pdfName, content: pdfBuffer }]
      );
    }
    return NextResponse.json({ ok: true, fileName, pdfName, emailStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Submission failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
