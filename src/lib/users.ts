import path from "path";
import fs from "fs/promises";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";

export type UserProfile = {
  employeeNumber: string;
  name: string;
  surname: string;
  idNumber: string;
  cellphoneNumber: string;
  companyName: string;
  bankName: string;
  accountNumber: string;
  employer: string;
  dateOfEngagement: string;
  idDocumentFile: string;
  passwordHash: string;
};

const usersPath = path.join(process.cwd(), "data", "users.xlsx");
const sheetName = "Users";
const columnOrder = [
  "Employee Number",
  "Full Names",
  "Surname",
  "ID number",
  "Cellphone Number",
  "Company Name",
  "Employer",
  "Date of Engagement",
  "Bank Name",
  "Account Number",
  "ID Document",
  "Password",
];
function isFileLockedError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const code = (error as NodeJS.ErrnoException).code;
  if (code && ["EBUSY", "EPERM", "EACCES"].includes(code)) return true;
  const message = error.message.toLowerCase();
  return message.includes("file is locked") || message.includes("used by another process");
}

async function writeWorkbookWithRetry(workbook: XLSX.WorkBook, filePath: string) {
  const attempts = 3;
  for (let i = 0; i < attempts; i += 1) {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const tempPath = filePath.replace(/\.xlsx$/i, `.tmp-${Date.now()}.xlsx`);
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      await fs.writeFile(tempPath, buffer);
      try {
        await fs.unlink(filePath);
      } catch {
        // ignore if missing
      }
      await fs.rename(tempPath, filePath);
      return;
    } catch (error) {
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }
      if (isFileLockedError(error)) {
        throw new Error(
          `Cannot access file ${filePath}. Please close the Excel file and try again.`
        );
      }
      const message = error instanceof Error ? error.message : "Unknown error.";
      throw new Error(`Cannot save file ${filePath}: ${message}`);
    }
  }
}

async function ensureUsersFile() {
  try {
    await fs.access(usersPath);
    return;
  } catch {
    const seedHash =
      "$2b$10$707z2PQU0OmWA6OaO9UCxORrVV0mUHLWP12QLRcOzBJXXjiO3Aznq";
    const seed = [
      {
        "Employee Number": "EMP001",
        "Full Names": "Thando",
        Surname: "Mokoena",
        "ID number": "8001015009087",
        "Cellphone Number": "0712345678",
        "Company Name": "Pronto Holdings",
        Employer: "Pronto Holdings",
        "Date of Engagement": "2020-01-01",
        "Bank Name": "FNB",
        "Account Number": "62123456789",
        Password: seedHash,
      },
    ];
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(seed, { header: columnOrder });
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    const employersSheet = XLSX.utils.json_to_sheet([], { header: ["Employer"] });
    XLSX.utils.book_append_sheet(workbook, employersSheet, "Employers");
    await writeWorkbookWithRetry(workbook, usersPath);
  }
}

function rowToUser(row: Record<string, string>): UserProfile {
  return {
    employeeNumber: row["Employee Number"] ?? "",
    name: row["Full Names"] ?? "",
    surname: row["Surname"] ?? "",
    idNumber: row["ID number"] ?? "",
    cellphoneNumber: row["Cellphone Number"] ?? "",
    companyName: row["Company Name"] ?? "",
    employer: row["Employer"] ?? "",
    bankName: row["Bank Name"] ?? "",
    accountNumber: row["Account Number"] ?? "",
    dateOfEngagement: row["Date of Engagement"] ?? "",
    idDocumentFile: row["ID Document"] ?? "",
    passwordHash: row["Password"] ?? "",
  };
}

function userToRow(user: UserProfile) {
  return {
    "Employee Number": user.employeeNumber,
    "Full Names": user.name,
    Surname: user.surname,
    "ID number": user.idNumber,
    "Cellphone Number": user.cellphoneNumber,
    "Company Name": user.companyName,
    Employer: user.employer,
    "Date of Engagement": user.dateOfEngagement,
    "Bank Name": user.bankName,
    "Account Number": user.accountNumber,
    "ID Document": user.idDocumentFile,
    Password: user.passwordHash,
  };
}

async function readAllUsers(): Promise<UserProfile[]> {
  await ensureUsersFile();
  let workbook: XLSX.WorkBook;
  try {
    const buffer = await fs.readFile(usersPath);
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch (error) {
    if (isFileLockedError(error)) {
      throw new Error(
        `Cannot access file ${usersPath}. Please close the Excel file and try again.`
      );
    }
    // Attempt recovery: recreate file and retry once
    try {
      await fs.unlink(usersPath);
    } catch {
      // ignore if delete fails
    }
    await ensureUsersFile();
    try {
      const buffer = await fs.readFile(usersPath);
      workbook = XLSX.read(buffer, { type: "buffer" });
    } catch (retryError) {
      const message =
        retryError instanceof Error ? retryError.message : "Unknown error.";
      throw new Error(`Failed to read users.xlsx: ${message}`);
    }
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
  });
  return rows.map(rowToUser);
}

async function writeAllUsers(users: UserProfile[]) {
  const workbook = XLSX.utils.book_new();
  const rows = users.map(userToRow);
  const sheet = XLSX.utils.json_to_sheet(rows, { header: columnOrder });
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  await writeWorkbookWithRetry(workbook, usersPath);
}

export async function getUserByEmployeeNumber(employeeNumber: string) {
  const users = await readAllUsers();
  return users.find(
    (user) => user.employeeNumber.toLowerCase() === employeeNumber.toLowerCase()
  );
}
function isBcryptHash(value: string) {
  return value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$");
}

export async function updateUserPassword(employeeNumber: string, passwordHash: string) {
  const users = await readAllUsers();
  const index = users.findIndex(
    (user) => user.employeeNumber.toLowerCase() === employeeNumber.toLowerCase()
  );
  if (index === -1) return;
  users[index] = { ...users[index], passwordHash };
  await writeAllUsers(users);
}

export async function verifyPassword(user: UserProfile, password: string) {
  if (isBcryptHash(user.passwordHash)) {
    return bcrypt.compare(password, user.passwordHash);
  }
  if (user.passwordHash === password) {
    try {
      const newHash = await bcrypt.hash(password, 10);
      await updateUserPassword(user.employeeNumber, newHash);
    } catch {
      // Ignore update failures (e.g., read-only filesystem in production)
    }
    return true;
  }
  return false;
  return bcrypt.compare(password, user.passwordHash);
}

export function sanitizeUser(user: UserProfile) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

export async function createUser(
  profile: Omit<UserProfile, "passwordHash">,
  password: string
) {
  const users = await readAllUsers();
  const exists = users.find(
    (user) => user.employeeNumber.toLowerCase() === profile.employeeNumber.toLowerCase()
  );
  if (exists) {
    throw new Error("Employee number already exists.");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const newUser: UserProfile = { ...profile, passwordHash };
  users.push(newUser);
  await writeAllUsers(users);
  return newUser;
}
