import path from "path";
import fs from "fs/promises";
import * as XLSX from "xlsx";

const usersPath = path.join(process.cwd(), "data", "C:\Users\Pronto\pronto_loans_application\data/users.xlsx");
const sheetName = "Employers";

export async function getEmployers() {
  try {
    const buffer = await fs.readFile(usersPath);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    let sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      sheet = XLSX.utils.json_to_sheet([], { header: ["Employer"] });
      XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
      const out = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      await fs.writeFile(usersPath, out);
    }
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
      defval: "",
    });
    return rows
      .map((row) => row["Employer"] ?? row["Name"] ?? "")
      .map((name) => String(name).trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
