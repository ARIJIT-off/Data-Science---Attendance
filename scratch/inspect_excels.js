const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const cwd = 'c:\\Users\\aleri\\Downloads\\new attendance';

function inspectFile(filename) {
  const filePath = path.join(cwd, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`${filename} does not exist`);
    return;
  }
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  console.log(`\n--- ${filename} ---`);
  console.log(`Total rows: ${data.length}`);
  
  const matches = data.filter(row => {
    return Object.values(row).some(val => 
      val && val.toString().toLowerCase().includes('arijit')
    );
  });
  console.log("Search 'Arijit' matches:", matches);
}

inspectFile('admin data.xlsx');
inspectFile('teacher data.xlsx');
