const fs = require('fs');

let code = fs.readFileSync('server.js', 'utf8');

// 1. Rewrite getAllStudents
code = code.replace(
  /function getAllStudents\(\) \{[\s\S]*?\n\s*\}\n\s*\} catch \(e\) \{[\s\S]*?\n\s*\}\n\}/m,
  `async function getAllStudents() {
  try {
    const users = await User.find({ role: { $regex: /^student$/i } }).lean();
    return users.map(u => ({
      roll: u.rollNo || u.roll || '',
      name: u.name,
      enrollment: u.enrollmentNo || u.enrollment || '',
      year: u.year || '2nd Year',
      section: u.section || 'Sec A',
      email: u.email
    }));
  } catch (e) {
    console.error('Error in getAllStudents:', e.message);
    return [];
  }
}`
);

// 2. Rewrite getAllTeachers
code = code.replace(
  /function getAllTeachers\(\) \{[\s\S]*?\n\s*\}\n\s*\} catch \(e\) \{[\s\S]*?\n\s*\}\n\}/m,
  `async function getAllTeachers() {
  try {
    const users = await User.find({ role: { $regex: /^teacher$/i } }).lean();
    return users.map(u => ({
      name: u.name,
      email: u.email,
      department: u.department || ''
    }));
  } catch (e) {
    console.error('Error in getAllTeachers:', e.message);
    return [];
  }
}`
);

// 3. Rewrite findStudentEmailByName
code = code.replace(
  /\/\/ Helper: Find student email by name in database sheets[\s\S]*?function findStudentEmailByName\(name\) \{[\s\S]*?return null;\n\}/m,
  `// Helper: Find student email by name
async function findStudentEmailByName(name) {
  try {
    const nameLower = name.toLowerCase().trim();
    const user = await User.findOne({ name: { $regex: new RegExp(\`^\${nameLower}$\`, 'i') }, role: { $regex: /^student$/i } }).lean();
    if (user && user.email) return user.email;
    const user2 = await User.findOne({ additionalName: { $regex: new RegExp(\`^\${nameLower}$\`, 'i') } }).lean();
    if (user2 && user2.additionalEmail) return user2.additionalEmail;
  } catch (e) {
    console.error("Error searching student email:", e.message);
  }
  return null;
}`
);

// 4. Update the caller in /api/send-otp
code = code.replace(
  /const studentInfo = findStudentByEnrollmentAndRoll\(enrollmentNo, rollNo\);/g,
  `const studentInfo = await findStudentByEnrollmentAndRoll(enrollmentNo, rollNo);`
);

code = code.replace(
  /userEmail = findStudentEmailByName\(studentInfo\.name\);/g,
  `userEmail = await findStudentEmailByName(studentInfo.name);`
);

// 5. Update the caller in /api/student-list
code = code.replace(
  /app\.get\('\/api\/student-list', \(req, res\) => \{/,
  `app.get('/api/student-list', async (req, res) => {`
);
code = code.replace(
  /const students = getAllStudents\(\);/,
  `const students = await getAllStudents();`
);

// 6. Update the callers in /api/attendance/stats
code = code.replace(
  /const students = getAllStudents\(\);/,
  `const students = await getAllStudents();`
);
code = code.replace(
  /const teachers = getAllTeachers\(\);/,
  `const teachers = await getAllTeachers();`
);

// 7. Update the caller in /api/teacher/sessions/:token/close
code = code.replace(
  /const allStudents = getAllStudents\(\);/,
  `const allStudents = await getAllStudents();`
);

// Write back
fs.writeFileSync('server.js', code);
console.log('Done rewrites.');
