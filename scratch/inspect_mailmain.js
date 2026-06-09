const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join(__dirname, '..', 'mailmain.xlsx');
if (fs.existsSync(filePath)) {
  const workbook = xlsx.readFile(filePath);
  console.log("Sheets:", workbook.SheetNames);
  workbook.SheetNames.forEach(sheetName => {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    console.log(data);
  });
} else {
  console.log("mailmain.xlsx not found");
}
