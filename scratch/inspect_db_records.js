const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://noreplyuemkattendance_db_user:Xuelk1U1ZC0wBMEt@cluster0.1qgvtim.mongodb.net/attendance?retryWrites=true&w=majority";

async function inspect() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB.");

    const Attendance = mongoose.model('Attendance', new mongoose.Schema({}, { strict: false }));
    const Student = mongoose.model('Student', new mongoose.Schema({}, { strict: false }));
    const Teacher = mongoose.model('Teacher', new mongoose.Schema({}, { strict: false }));

    const studentCount = await Student.countDocuments();
    const teacherCount = await Teacher.countDocuments();
    const attendanceCount = await Attendance.countDocuments();

    console.log("Database Stats:");
    console.log("Students:", studentCount);
    console.log("Teachers:", teacherCount);
    console.log("Attendance Records:", attendanceCount);

    if (attendanceCount > 0) {
      console.log("\nRecent Attendance Records:");
      const records = await Attendance.find().sort({ createdAt: -1 }).limit(5);
      console.log(JSON.stringify(records, null, 2));
    } else {
      console.log("\nNo attendance records found in MongoDB Atlas.");
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

inspect();
