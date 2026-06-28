const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  sectionName: { type: String, required: true },
  year: { type: String, required: true }
});

module.exports = mongoose.model('Section', sectionSchema);
