import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { createUser, sanitizeUser } from "@/lib/users";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.employeeNumber || !body?.password) {
    return NextResponse.json(
      { error: "Employee number and password are required." },
      { status: 400 }
    );
  }
  if (!body?.idDocumentFile) {
    return NextResponse.json(
      { error: "ID document upload is required." },
      { status: 400 }
    );
  }

  try {
    const user = await createUser(
      {
        employeeNumber: body.employeeNumber,
        name: body.name ?? "",
        surname: body.surname ?? "",
        idNumber: body.idNumber ?? "",
        cellphoneNumber: body.cellphoneNumber ?? "",
        companyName: body.companyName ?? "",
        employer: body.employer ?? "",
        dateOfEngagement: body.dateOfEngagement ?? "",
        bankName: body.bankName ?? "",
        accountNumber: body.accountNumber ?? "",
        idDocumentFile: body.idDocumentFile ?? "",
      },
      body.password
    );

    const token = await createSession(user.employeeNumber);
    const response = NextResponse.json({ user: sanitizeUser(user) });
    response.cookies.set({
      name: "session_token",
      value: token,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Registration failed." },
      { status: 400 }
    );
  }
}
