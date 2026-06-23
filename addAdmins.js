const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    await User.updateOne(
      { email: 'nilanjan.chatterjee@uem.edu.in' },
      { $set: { role: 'Admin' } }
    );
    await User.updateOne(
      { email: 'buddhadeb.pradhan@uem.edu.in' },
      { $set: { role: 'Admin' } }
    );
    await User.updateOne(
      { email: 'anay.ghosh@uem.edu.in' },
      { $set: { role: 'Admin' } }
    );
    
    // Add chak.ayantika@gmail.com
    await User.updateOne(
      { email: 'chak.ayantika@gmail.com' },
      { $set: { name: 'Ayantika', role: 'Admin', department: 'CSE Data Science', mobile: 'N/A' } },
      { upsert: true }
    );

    // Also add the user's main email as admin if it's not already
    await User.updateOne(
      { email: 'ap2446961@gmail.com' },
      { $set: { role: 'Admin' } }
    );
    
    console.log('Fixed admin roles and added chak.ayantika@gmail.com');
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
});
