const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function createTestExcel() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('DatesTest');
  
  worksheet.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Event', key: 'event', width: 30 },
    { header: 'Date', key: 'date', width: 20 },
    { header: 'Amount', key: 'amount', width: 15 }
  ];
  
  worksheet.addRow({ id: 1, event: 'Purchase A', date: new Date('2024-01-15'), amount: 50.00 });
  worksheet.addRow({ id: 2, event: 'Purchase B', date: new Date('2024-02-20'), amount: 150.00 });
  worksheet.addRow({ id: 3, event: 'Purchase C', date: new Date('2024-03-25'), amount: 250.00 });
  
  const filePath = path.join(__dirname, 'test_dates.xlsx');
  await workbook.xlsx.writeFile(filePath);
  console.log('✅ Created test_dates.xlsx at', filePath);
}

createTestExcel();
