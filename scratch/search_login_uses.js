const fs = require('fs');
const path = require('path');

function searchDir(dir, pattern) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        searchDir(fullPath, pattern);
      }
    } else {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(pattern)) {
        console.log(`Found "${pattern}" in file: ${fullPath}`);
      }
    }
  }
}

console.log("Searching for 'teacher-admin-login'...");
searchDir('c:\\Users\\aleri\\Downloads\\new attendance', 'teacher-admin-login');

console.log("Searching for '/api/student-login'...");
searchDir('c:\\Users\\aleri\\Downloads\\new attendance', 'student-login');
