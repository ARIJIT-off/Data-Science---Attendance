const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, index: true }, // The email this OTP belongs to
  otp: { type: String, required: true },
  role: { type: String },
  profile: { type: mongoose.Schema.Types.Mixed }, // Stores user profile for login
  
  // Fields for Email Change feature
  type: { type: String, default: 'login', enum: ['login', 'email_change'] },
  currentEmail: { type: String, lowercase: true },
  newEmail: { type: String, lowercase: true },
  
  createdAt: { type: Date, default: Date.now, expires: 300 } // TTL index: documents expire after 300 seconds (5 mins)
});

module.exports = mongoose.model('Otp', otpSchema);
