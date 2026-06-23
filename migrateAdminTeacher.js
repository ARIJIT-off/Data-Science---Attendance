const mongoose = require('mongoose');
const xlsx = require('xlsx');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  try {
    const adminData = xlsx.utils.sheet_to_json(xlsx.readFile('admin data.xlsx').Sheets[xlsx.readFile('admin data.xlsx').SheetNames[0]]);
    const teacherData = xlsx.utils.sheet_to_json(xlsx.readFile('teacher data.xlsx').Sheets[xlsx.readFile('teacher data.xlsx').SheetNames[0]]);

    for (const r of adminData) {
      if (r.Email && r.Role !== 'Student') {
        await User.updateOne(
          { email: r.Email.toString().trim().toLowerCase() },
          { 
            $set: {
              name: r.Name ? r.Name.toString().trim() : '',
              mobile: r.Mobile ? r.Mobile.toString().trim() : '',
              role: 'Admin',
              department: r.Department ? r.Department.toString().trim() : 'CSE Data Science'
            }
          },
          { upsert: true }
        );
      }
    }

    for (const r of teacherData) {
      if (r['Supervisor Email']) {
        await User.updateOne(
          { email: r['Supervisor Email'].toString().trim().toLowerCase() },
          {
            $set: {
              name: r['Supervisor Name'] ? r['Supervisor Name'].toString().trim() : '',
              mobile: r['Supervisor Mobile'] ? r['Supervisor Mobile'].toString().trim() : '',
              role: 'Teacher',
              additionalName: r['Additional Name'] ? r['Additional Name'].toString().trim() : '',
              additionalMobile: r['Additional Mobile'] ? r['Additional Mobile'].toString().trim() : '',
              additionalEmail: r['Additional Email'] ? r['Additional Email'].toString().trim().toLowerCase() : ''
            }
          },
          { upsert: true }
        );
      }
    }

    const a = await User.countDocuments({role: 'Admin'});
    const t = await User.countDocuments({role: 'Teacher'});
    console.log('Migration complete. Admins:', a, 'Teachers:', t);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
});
