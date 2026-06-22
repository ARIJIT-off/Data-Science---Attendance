const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mailmain.xlsx');
console.log('Reading from:', filePath);

try {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  let updated = false;
  const updatedData = data.map(row => {
    if (row && row[0]) {
      const field = row[0].toString().trim().toLowerCase();
      if (field.includes('password') || field.includes('app password')) {
        console.log(`Found password field: "${row[0]}", replacing value: "${row[1]}" with "rqdf vent dead ascw"`);
        row[1] = 'rqdf vent dead ascw';
        updated = true;
      }
    }
    return row;
  });

  if (!updated) {
    // If not found, add it
    console.log('Password field not found. Appending password row.');
    updatedData.push(['App Password', 'rqdf vent dead ascw']);
  }

  const newSheet = xlsx.utils.aoa_to_sheet(updatedData);
  workbook.Sheets[sheetName] = newSheet;
  xlsx.writeFile(workbook, filePath);
  console.log('Successfully updated mailmain.xlsx');
} catch (error) {
  console.error('Error modifying mailmain.xlsx:', error);
  process.exit(1);
}
