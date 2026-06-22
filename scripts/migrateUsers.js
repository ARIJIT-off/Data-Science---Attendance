require('dotenv').config();
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');

const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error("No MONGODB_URI found in .env. Exiting...");
  process.exit(1);
}

// Helper: Read excel safely
function readExcelFile(filename) {
  const filePath = path.join(__dirname, '..', filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`File ${filename} not found.`);
    return [];
  }
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
}

async function migrate() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    // Clear existing users just in case
    await User.deleteMany({});
    console.log("Cleared existing Users");

    const usersToInsert = [];

    // 1. Admin & Teachers from admin data.xlsx
    const adminRows = readExcelFile('admin data.xlsx');
    for (const row of adminRows) {
      if (!row.Email || !row.Role) continue;
      
      const role = row.Role.toString().trim();
      let normalizedRole;
      if (role.toUpperCase() === 'ADMIN') normalizedRole = 'Admin';
      else if (role.toUpperCase() === 'TEACHER') normalizedRole = 'Teacher';
      else if (role.toUpperCase() === 'STUDENT') normalizedRole = 'Student';
      else continue;

      usersToInsert.push({
        email: row.Email.toString().trim().toLowerCase(),
        name: row.Name ? row.Name.toString().trim() : '',
        role: normalizedRole,
        department: row.Department ? row.Department.toString().trim() : null,
        mobile: row.Mobile ? row.Mobile.toString().trim() : null
      });
    }

    // 2. Teachers from teacher data.xlsx (avoiding duplicates by email)
    const teacherRows = readExcelFile('teacher data.xlsx');
    for (const row of teacherRows) {
      if (!row.Email) continue;
      const email = row.Email.toString().trim().toLowerCase();
      
      const existing = usersToInsert.find(u => u.email === email);
      if (!existing) {
        usersToInsert.push({
          email: email,
          name: row.Name ? row.Name.toString().trim() : '',
          role: 'Teacher',
          department: row.Department ? row.Department.toString().trim() : null,
          mobile: row.Mobile ? row.Mobile.toString().trim() : null,
          designation: row.Designation ? row.Designation.toString().trim() : null
        });
      }
    }

    // 3. Students from student_list passout 2028.xlsx
    const filePath = path.join(__dirname, '..', 'student_list passout 2028.xlsx');
    if (fs.existsSync(filePath)) {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      
      let headerRowIndex = -1;
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row && row.includes('Class Roll') && row.includes('Enrollment No.')) {
          headerRowIndex = i;
          break;
        }
      }
      
      if (headerRowIndex !== -1) {
        const rollColIndex = data[headerRowIndex].indexOf('Class Roll');
        const nameColIndex = data[headerRowIndex].indexOf('Student Name');
        const enrollColIndex = data[headerRowIndex].indexOf('Enrollment No.');
        
        for (let i = headerRowIndex + 1; i < data.length; i++) {
          const row = data[i];
          if (row && row[rollColIndex] !== undefined && row[enrollColIndex] !== undefined) {
            const roll = row[rollColIndex].toString().trim();
            const enrollment = row[enrollColIndex].toString().trim();
            const name = row[nameColIndex] ? row[nameColIndex].toString().trim() : '';
            
            // Generate a default email since we don't have it in this sheet
            const studentEmail = `${enrollment.toLowerCase()}@student.local`;
            
            const existing = usersToInsert.find(u => u.enrollment === enrollment);
            if (!existing) {
              usersToInsert.push({
                email: studentEmail,
                name: name,
                role: 'Student',
                roll: roll,
                enrollment: enrollment
              });
            }
          }
        }
      }
    }

    // Insert all
    await User.insertMany(usersToInsert);
    console.log(`Successfully migrated ${usersToInsert.length} users to MongoDB.`);

    process.exit(0);
  } catch (e) {
    console.error("Migration failed:", e);
    process.exit(1);
  }
}

migrate();
