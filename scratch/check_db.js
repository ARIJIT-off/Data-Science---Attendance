require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 }).then(async () => {
  const exactCount = await User.countDocuments({ role: 'Student', year: '2nd Year', section: 'Sec A' });
  const legacyCount = await User.countDocuments({
    role: 'Student',
    $or: [{ year: { $exists: false } }, { year: null }, { year: '' }]
  });
  const total = await User.countDocuments({ role: 'Student' });
  console.log('Exact match (2nd Year / Sec A):', exactCount);
  console.log('Legacy (no year field):', legacyCount);
  console.log('Total students:', total);
  mongoose.disconnect();
}).catch(e => console.error(e.message));
