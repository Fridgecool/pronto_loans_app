import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type ApplicationData = {
  user: {
    employeeNumber: string;
    name: string;
    surname: string;
    idNumber: string;
    cellphoneNumber?: string;
    companyName: string;
    dateOfEngagement: string;
  };
  employmentDetails?: {
    companyName: string;
    employeeNumber: string;
    dateOfEngagement: string;
  };
  bankDetails: {
    bankName: string;
    accountNumber: string;
  };
  loanAmount: number;
  repaymentAmount: number;
  uploadResult: {
    payslip: string;
    bankStatement: string;
  };
  fileLinks?: {
    payslip: string;
    bankStatement: string;
    idDocument?: string;
  } | null;
  signatureData?: string;
};

export async function generateApplicationPDF(
  data: ApplicationData
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const margin = 50;
  let y = page.getHeight() - margin;

  const drawText = (text: string, size = 11, bold = false) => {
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: bold ? fontBold : font,
      color: rgb(0, 0, 0),
    });
    y -= size + 6;
  };

  drawText("Pronto Loans", 18, true);
  drawText("Loan Application", 14, true);
  y -= 8;

  const employment = data.employmentDetails ?? {
    companyName: data.user.companyName,
    employeeNumber: data.user.employeeNumber,
    dateOfEngagement: data.user.dateOfEngagement,
  };

  drawText("Client Details", 12, true);
  drawText(`Employee Number: ${employment.employeeNumber}`);
  drawText(`Full Name: ${data.user.name} ${data.user.surname}`);
  drawText(`ID Number: ${data.user.idNumber}`);
  if (data.user.cellphoneNumber) {
    drawText(`Cellphone: ${data.user.cellphoneNumber}`);
  }
  y -= 6;

  drawText("Employment Details", 12, true);
  drawText(`Company: ${employment.companyName}`);
  drawText(`Date of Engagement: ${employment.dateOfEngagement}`);
  y -= 6;

  drawText("Banking Details", 12, true);
  drawText(`Bank Name: ${data.bankDetails.bankName}`);
  drawText(`Account Number: ${data.bankDetails.accountNumber}`);
  y -= 6;

  drawText("Loan Information", 12, true);
  drawText(`Requested Loan Amount: R${data.loanAmount.toFixed(2)}`);
  drawText(`Estimated Repayment Amount: R${data.repaymentAmount.toFixed(2)}`);
  y -= 6;

  drawText("Supporting Documents", 12, true);
  drawText(`Payslip: ${data.uploadResult.payslip}`);
  drawText(`Bank Statement: ${data.uploadResult.bankStatement}`);
  if (data.fileLinks) {
    drawText("Document Links", 12, true);
    page.drawText(`Payslip link: ${data.fileLinks.payslip}`, {
      x: margin,
      y,
      size: 10,
      font,
      color: rgb(0, 0, 0.8),
    });
    y -= 16;
    page.drawText(`Bank link: ${data.fileLinks.bankStatement}`, {
      x: margin,
      y,
      size: 10,
      font,
      color: rgb(0, 0, 0.8),
    });
    y -= 16;
    if (data.fileLinks.idDocument) {
      page.drawText(`ID document link: ${data.fileLinks.idDocument}`, {
        x: margin,
        y,
        size: 10,
        font,
        color: rgb(0, 0, 0.8),
      });
      y -= 16;
    }
  }
  y -= 10;

  drawText("Signature", 12, true);
  if (data.signatureData) {
    try {
      const base64 = data.signatureData.split(",")[1];
      const imageBytes = Uint8Array.from(
        Buffer.from(base64, "base64")
      );
      const pngImage = await pdfDoc.embedPng(imageBytes);
      const imgDims = pngImage.scale(0.5);
      page.drawImage(pngImage, {
        x: margin,
        y: Math.max(y - imgDims.height, margin),
        width: Math.min(imgDims.width, 200),
        height: Math.min(imgDims.height, 80),
      });
    } catch {
      drawText("[Signature image not available]");
    }
  } else {
    drawText("[No signature captured]");
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
