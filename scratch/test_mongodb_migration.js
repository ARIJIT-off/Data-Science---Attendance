const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load environment variable or config
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("=========================================");
  console.error("ERROR: MONGODB_URI is not set!");
  console.error("To run this test, please configure MONGODB_URI.");
  console.error("Example: $env:MONGODB_URI=\"mongodb+srv://...\" (Windows PowerShell)");
  console.error("=========================================");
  process.exit(1);
}

// Inline Models for testing connection
const studentSchema = new mongoose.Schema({
  name: String,
  roll: String,
  enrollment: String,
  email: String,
  mobile: String,
  supervisorName: String,
  supervisorMobile: String,
  supervisorEmail: String,
  profilePic: String
});
const Student = mongoose.model('Student_Test', studentSchema);

const teacherSchema = new mongoose.Schema({
  name: String,
  email: String,
  mobile: String
});
const Teacher = mongoose.model('Teacher_Test', teacherSchema);

const adminSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: String
});
const Admin = mongoose.model('Admin_Test', adminSchema);

async function runTest() {
  try {
    console.log("Connecting to MongoDB Atlas at URI:", MONGODB_URI.split('@')[1] || MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    console.log("Connected successfully! ✅");

    console.log("\nTesting Student Insertion & Retrieval...");
    const testStudent = await Student.create({
      name: "TEST STUDENT",
      roll: "123",
      enrollment: "ENROLL12345",
      email: "student@test.com"
    });
    console.log("Inserted student:", testStudent.name);

    const foundStudent = await Student.findOne({ enrollment: "ENROLL12345" });
    console.log("Retrieved student:", foundStudent.name, "(Roll:", foundStudent.roll, ")");

    console.log("\nTesting Teacher Insertion & Retrieval...");
    const testTeacher = await Teacher.create({
      name: "TEST TEACHER",
      email: "teacher@test.com",
      mobile: "9876543210"
    });
    console.log("Inserted teacher:", testTeacher.name);

    console.log("\nCleaning up test collections...");
    await Student.deleteOne({ enrollment: "ENROLL12345" });
    await Teacher.deleteOne({ email: "teacher@test.com" });
    console.log("Cleanup completed successfully. ✅");

    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB. Verification test PASSED! 🎉");
  } catch (err) {
    console.error("Test failed: ❌", err.message);
    process.exit(1);
  }
}

runTest();
