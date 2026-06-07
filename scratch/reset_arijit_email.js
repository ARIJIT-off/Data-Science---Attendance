const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const cwd = 'c:\\Users\\aleri\\Downloads\\new attendance';

function resetEmail(filename, fieldName, targetName) {
  const filePath = path.join(cwd, filename);
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  let updated = false;
  data.forEach(row => {
    if (row[targetName] === 'Arijit Pal') {
      row[fieldName] = 'arijitp203@gmail.com';
      updated = true;
    }
  });
  
  if (updated) {
    const newSheet = xlsx.utils.json_to_sheet(data);
    workbook.Sheets[sheetName] = newSheet;
    xlsx.writeFile(workbook, filePath);
    console.log(`Successfully reset email in ${filename}`);
  } else {
    console.log(`Failed to find Arijit Pal in ${filename}`);
  }
}

resetEmail('admin data.xlsx', 'Email', 'Name');
resetEmail('teacher data.xlsx', 'Additional Email', 'Additional Name');
