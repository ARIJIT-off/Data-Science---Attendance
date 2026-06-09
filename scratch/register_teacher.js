const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '../teacher data.xlsx');
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet);

console.log('Columns:', Object.keys(data[0]));

// Add a test teacher
const newTeacher = {
  'Supervisor Name': 'Resend Test Teacher',
  'Supervisor Email': 'noreply.uemk.attendance@gmail.com',
  'Supervisor Mobile': '1234567890'
};

data.push(newTeacher);
const newSheet = xlsx.utils.json_to_sheet(data);
workbook.Sheets[sheetName] = newSheet;
xlsx.writeFile(workbook, filePath);
console.log('Registered Resend Test Teacher successfully.');
