const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  subjectCode: { type: String, required: true },
  subjectName: { type: String, required: true },
  year: { type: String, required: true },
  semester: { type: String, required: true }
});

module.exports = mongoose.model('Subject', subjectSchema);
