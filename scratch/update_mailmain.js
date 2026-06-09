const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join(__dirname, '..', 'mailmain.xlsx');
if (fs.existsSync(filePath)) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  // Check if MongoDB URI already exists, if so update it, otherwise add new
  let foundIndex = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i] && data[i][0] && data[i][0].toString().trim().toLowerCase().includes('mongodb uri')) {
      foundIndex = i;
      break;
    }
  }

  const newRow = [
    'MongoDB URI',
    'mongodb+srv://noreplyuemkattendance_db_user:Xuelk1U1ZC0wBMEt@cluster0.1qgvtim.mongodb.net/attendance?retryWrites=true&w=majority'
  ];

  if (foundIndex !== -1) {
    data[foundIndex] = newRow;
  } else {
    data.push(newRow);
  }

  const newSheet = xlsx.utils.aoa_to_sheet(data);
  workbook.Sheets[sheetName] = newSheet;
  xlsx.writeFile(workbook, filePath);
  console.log("Successfully appended MongoDB URI to mailmain.xlsx!");
} else {
  console.log("mailmain.xlsx not found!");
}
