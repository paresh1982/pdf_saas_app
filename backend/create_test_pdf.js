const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');

async function createPdf() {
  const pdfDoc = await PDFDocument.create();
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);

  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const fontSize = 30;
  page.drawText('Sample Invoice', {
    x: 50,
    y: height - 4 * fontSize,
    size: fontSize,
    font: timesRomanFont,
    color: rgb(0, 0.53, 0.71),
  });

  page.drawText('Date: 2024-12-05', {
    x: 50,
    y: height - 5 * fontSize,
    size: 14,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  });

  page.drawText('Item: Cloud Storage - $50\nItem: API Integration - $250', {
    x: 50,
    y: height - 8 * fontSize,
    size: 12,
    font: timesRomanFont,
    color: rgb(0, 0, 0),
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('backend/test_invoice.pdf', pdfBytes);
}

createPdf();
