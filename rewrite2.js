const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

function replaceBlock(startSig, endSig, newCode) {
  const start = code.indexOf(startSig);
  if (start === -1) {
    console.log("Could not find", startSig);
    return;
  }
  let end = code.indexOf(endSig, start);
  if (end === -1) {
    console.log("Could not find end", endSig);
    return;
  }
  end += endSig.length;
  code = code.substring(0, start) + newCode + code.substring(end);
}

// 1. getAllStudents
replaceBlock(
  "function getAllStudents() {",
  "    return [];\n  }\n}",
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

// 2. getAllTeachers
replaceBlock(
  "function getAllTeachers() {",
  "    return [];\n  }\n}",
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

// 3. findStudentEmailByName
replaceBlock(
  "function findStudentEmailByName(name) {",
  "  return null;\n}",
  `async function findStudentEmailByName(name) {
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

// 4. In app.post('/api/student-login', (req, res) => {
// It needs to be async
code = code.replace(
  "app.post('/api/student-login', (req, res) => {",
  "app.post('/api/student-login', async (req, res) => {"
);

// 5. In app.get('/api/teacher-list', (req, res) => {
code = code.replace(
  "app.get('/api/teacher-list', (req, res) => {",
  "app.get('/api/teacher-list', async (req, res) => {"
);

// 6. Fix `const teachers = getAllTeachers();` in stats
code = code.replace(
  "const teachers = getAllTeachers();",
  "const teachers = await getAllTeachers();"
);


fs.writeFileSync('server.js', code);
console.log('Done.');
