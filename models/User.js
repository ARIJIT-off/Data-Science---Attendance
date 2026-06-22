const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, lowercase: true, index: true }, // May be optional for some students initially, but usually required
  name: { type: String, required: true },
  role: { type: String, enum: ['Admin', 'Teacher', 'Student'], required: true, index: true },
  
  // Teacher / Admin specific fields
  department: { type: String },
  mobile: { type: String },
  designation: { type: String },

  // Student specific fields
  enrollment: { type: String },
  roll: { type: String },
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
