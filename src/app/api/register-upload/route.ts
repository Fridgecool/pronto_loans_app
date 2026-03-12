import path from "path";
import fs from "fs/promises";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const formData = await request.formData();
  const idDocument = formData.get("idDocument");
  const employeeNumber = String(formData.get("employeeNumber") ?? "").trim();

  if (!employeeNumber) {
    return NextResponse.json(
      { error: "Employee number is required before upload." },
      { status: 400 }
    );
  }

  if (!(idDocument instanceof File)) {
    return NextResponse.json(
      { error: "ID document file is required." },
      { status: 400 }
    );
  }

  if (idDocument.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File size exceeds 2MB limit." },
      { status: 400 }
    );
  }

  const uploadsDir = path.join(process.cwd(), "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });

  const ext = path.extname(idDocument.name) || ".file";
  const fileName = `${employeeNumber}-${Date.now()}-id${ext}`;
  const filePath = path.join(uploadsDir, fileName);

  await fs.writeFile(filePath, Buffer.from(await idDocument.arrayBuffer()));

  return NextResponse.json({ idDocumentFile: fileName });
}
