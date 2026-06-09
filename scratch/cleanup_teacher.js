const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../teacher data.xlsx');
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
let data = xlsx.utils.sheet_to_json(sheet);

// Filter out the test teacher
data = data.filter(t => t['Supervisor Email'] !== 'noreply.uemk.attendance@gmail.com');

const newSheet = xlsx.utils.json_to_sheet(data);
workbook.Sheets[sheetName] = newSheet;
xlsx.writeFile(workbook, filePath);
console.log('Cleaned up Resend Test Teacher successfully.');
