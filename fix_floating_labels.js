const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'teacher.html');
let html = fs.readFileSync(filePath, 'utf8');

// Regex to find a form-group with a label then input/select/textarea
const regex = /(<div class="form-group"[^>]*>)\s*(<label[^>]*>.*?<\/label>)\s*(<input[^>]*>|<select[^>]*>[\s\S]*?<\/select>|<textarea[^>]*>[\s\S]*?<\/textarea>)/g;

let matchCount = 0;
const newHtml = html.replace(regex, (match, divOpen, label, inputElement) => {
  matchCount++;
  // If it's an input or textarea, we need to ensure it has a placeholder so :placeholder-shown works.
  let modInput = inputElement;
  if (modInput.startsWith('<input') && !modInput.includes('placeholder=')) {
    modInput = modInput.replace('<input', '<input placeholder=" "');
  } else if (modInput.startsWith('<textarea') && !modInput.includes('placeholder=')) {
    modInput = modInput.replace('<textarea', '<textarea placeholder=" "');
  }
  return `${divOpen}\n                  ${modInput}\n                  ${label}`;
});

fs.writeFileSync(filePath, newHtml, 'utf8');
console.log(`Replaced ${matchCount} form groups.`);
