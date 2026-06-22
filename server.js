require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// ============================================================
// DATABASE SETUP - MongoDB Atlas with JSON file fallback
// ============================================================

const MONGODB_URI = process.env.MONGODB_URI || null;
let useMongoDb = false;

if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('Connected to MongoDB Atlas successfully.');
      useMongoDb = true;
    })
    .catch(err => {
      console.error('MongoDB connection failed. Falling back to local JSON files.', err.message);
      useMongoDb = false;
    });
} else {
  console.log('No MONGODB_URI set. Using local JSON files for storage.');
}

// ---- Mongoose Schemas & Models ----

const studentEntrySchema = new mongoose.Schema({
  name: String, roll: String, enrollment: String, present: Boolean
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  date: String,
  subject: String,
  year: String,
  semester: String,
  section: String,
  teacherEmail: String,
  teacherName: String,
  students: [studentEntrySchema],
  source: String,
  sessionToken: String,
  createdAt: String
});

const markedStudentSchema = new mongoose.Schema({
  name: String, roll: String, enrollment: String, markedAt: String
}, { _id: false });

const sessionSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  teacherEmail: String,
  teacherName: String,
  subject: String,
  year: String,
  semester: String,
  section: String,
  date: String,
  status: { type: String, default: 'active' },
  markedStudents: [markedStudentSchema],
  createdAt: String,
  expiresAt: String,
  closedAt: String
});

const grievanceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  senderRole: String,
  senderName: String,
  senderEmail: String,
  studentRoll: String,
  studentEnrollment: String,
  studentName: String,
  message: String,
  createdAt: String
});

const AttendanceModel = mongoose.model('Attendance', attendanceSchema);
const SessionModel = mongoose.model('Session', sessionSchema);
const GrievanceModel = mongoose.model('Grievance', grievanceSchema);

// ---- Local JSON file paths (fallback) ----
const ATTENDANCE_FILE = path.join(__dirname, 'attendance_data.json');
const GRIEVANCES_FILE = path.join(__dirname, 'grievances.json');
const SESSIONS_FILE = path.join(__dirname, 'sessions_data.json');

// ---- JSON fallback helpers ----
function _jsonRead(filePath) {
  try {
    if (!fs.existsSync(filePath)) { fs.writeFileSync(filePath, '[]', 'utf8'); return []; }
    return JSON.parse(fs.readFileSync(filePath, 'utf8') || '[]');
  } catch (e) { console.error('JSON read error:', e.message); return []; }
}
function _jsonWrite(filePath, data) {
  try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8'); }
  catch (e) { console.error('JSON write error:', e.message); }
}

// ============================================================
// ASYNC DATA ACCESS HELPERS (MongoDB or JSON fallback)
// ============================================================

async function readAttendanceData() {
  if (useMongoDb) {
    const docs = await AttendanceModel.find({}).lean();
    return docs;
  }
  return _jsonRead(ATTENDANCE_FILE);
}

async function writeAttendanceRecord(record) {
  if (useMongoDb) {
    await AttendanceModel.create(record);
  } else {
    const data = _jsonRead(ATTENDANCE_FILE);
    data.push(record);
    _jsonWrite(ATTENDANCE_FILE, data);
  }
}

async function deleteAttendanceRecord(id) {
  if (useMongoDb) {
    const result = await AttendanceModel.deleteOne({ id });
    return result.deletedCount > 0;
  }
  const data = _jsonRead(ATTENDANCE_FILE);
  const filtered = data.filter(r => r.id !== id);
  if (filtered.length === data.length) return false;
  _jsonWrite(ATTENDANCE_FILE, filtered);
  return true;
}

async function updateStudentInAttendanceRecord(recordId, enrollment, present) {
  if (useMongoDb) {
    const doc = await AttendanceModel.findOne({ id: recordId });
    if (!doc) return null;
    const student = doc.students.find(s => s.enrollment === enrollment);
    if (!student) return null;
    student.present = !!present;
    await doc.save();
    return doc.toObject();
  }
  const data = _jsonRead(ATTENDANCE_FILE);
  const record = data.find(r => r.id === recordId);
  if (!record) return null;
  const student = record.students.find(s => s.enrollment === enrollment);
  if (!student) return null;
  student.present = !!present;
  _jsonWrite(ATTENDANCE_FILE, data);
  return record;
}

async function readSessionsData() {
  if (useMongoDb) {
    const docs = await SessionModel.find({}).lean();
    return docs;
  }
  return _jsonRead(SESSIONS_FILE);
}

async function writeSessionRecord(session) {
  if (useMongoDb) {
    await SessionModel.create(session);
  } else {
    const data = _jsonRead(SESSIONS_FILE);
    data.push(session);
    _jsonWrite(SESSIONS_FILE, data);
  }
}

async function updateSession(token, updates) {
  if (useMongoDb) {
    await SessionModel.updateOne({ token }, { $set: updates });
  } else {
    const data = _jsonRead(SESSIONS_FILE);
    const idx = data.findIndex(s => s.token === token);
    if (idx !== -1) {
      Object.assign(data[idx], updates);
      _jsonWrite(SESSIONS_FILE, data);
    }
  }
}

async function pushMarkedStudent(token, studentEntry) {
  if (useMongoDb) {
    await SessionModel.updateOne({ token }, { $push: { markedStudents: studentEntry } });
  } else {
    const data = _jsonRead(SESSIONS_FILE);
    const session = data.find(s => s.token === token);
    if (session) {
      session.markedStudents.push(studentEntry);
      _jsonWrite(SESSIONS_FILE, data);
    }
  }
}

async function readGrievanceData() {
  if (useMongoDb) {
    const docs = await GrievanceModel.find({}).lean();
    return docs;
  }
  return _jsonRead(GRIEVANCES_FILE);
}

async function writeGrievanceRecord(record) {
  if (useMongoDb) {
    await GrievanceModel.create(record);
  } else {
    const data = _jsonRead(GRIEVANCES_FILE);
    data.push(record);
    _jsonWrite(GRIEVANCES_FILE, data);
  }
}

async function deleteGrievanceRecord(id) {
  if (useMongoDb) {
    const result = await GrievanceModel.deleteOne({ id });
    return result.deletedCount > 0;
  }
  const data = _jsonRead(GRIEVANCES_FILE);
  const filtered = data.filter(g => g.id !== id);
  if (filtered.length === data.length) return false;
  _jsonWrite(GRIEVANCES_FILE, filtered);
  return true;
}

// Helper: Generate a cryptographically-styled unique session token
function generateSessionToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 24; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

// Helper: Get all students from student list Excel
function getAllStudents() {
  try {
    const filePath = path.join(__dirname, 'student_list passout 2028.xlsx');
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    let headerRowIndex = -1;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row && row.includes('Class Roll') && row.includes('Student Name')) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) return [];

    const rollCol = data[headerRowIndex].indexOf('Class Roll');
    const nameCol = data[headerRowIndex].indexOf('Student Name');
    const enrollCol = data[headerRowIndex].indexOf('Enrollment No.');
    const yearCol = data[headerRowIndex].indexOf('Year');
    const sectionCol = data[headerRowIndex].indexOf('Section');

    const students = [];
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (row && row[rollCol] !== undefined && row[rollCol] !== null && row[nameCol]) {
        students.push({
          roll: row[rollCol].toString().trim(),
          name: row[nameCol].toString().trim(),
          enrollment: row[enrollCol] ? row[enrollCol].toString().trim() : '',
          year: yearCol !== -1 && row[yearCol] ? row[yearCol].toString().trim() : '2nd Year',
          section: sectionCol !== -1 && row[sectionCol] ? row[sectionCol].toString().trim() : 'Sec A'
        });
      }
    }
    return students;
  } catch (e) {
    console.error('Error reading student list:', e.message);
    return [];
  }
}

// Helper: Get all teachers from teacher data Excel
function getAllTeachers() {
  try {
    const rows = readExcelFile('teacher data.xlsx');
    const teachers = [];
    const seen = new Set();
    rows.forEach(r => {
      if (r['Supervisor Name'] && r['Supervisor Email']) {
        const email = r['Supervisor Email'].toString().trim();
        if (!seen.has(email.toLowerCase())) {
          seen.add(email.toLowerCase());
          teachers.push({
            name: r['Supervisor Name'].toString().trim(),
            email: email,
            mobile: r['Supervisor Mobile'] ? r['Supervisor Mobile'].toString().trim() : 'N/A'
          });
        }
      }
    });
    return teachers;
  } catch (e) {
    console.error('Error reading teacher list:', e.message);
    return [];
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Temporary in-memory cache for OTPs
// Structure: { email: { otp: '1234', role: 'Student', profile: {...}, expiresAt: timestamp } }
const Otp = require('./models/Otp');
const Subject = require('./models/Subject');

// Cache replaced by MongoDB Otp collection for serverless compatibility

// Helper: load SMTP credentials from mailmain.xlsx
function loadCredentials() {
  try {
    // 1. Try Environment Variables first (Best for Render/Cloud)
    if (process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD) {
      console.log(`Loaded credentials from Environment: Sender Email is ${process.env.SMTP_EMAIL}`);
      return { email: process.env.SMTP_EMAIL, password: process.env.SMTP_PASSWORD };
    }

    // 2. Fallback to mailmain.xlsx (For local development)
    const workbook = xlsx.readFile(path.join(__dirname, 'mailmain.xlsx'));
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    let email = null;
    let password = null;

    data.forEach(row => {
      if (row && row[0] && row[1]) {
        const field = row[0].toString().trim().toLowerCase();
        const val = row[1].toString().trim();
        if (field.includes('email')) {
          email = val;
        } else if (field.includes('password') || field.includes('app password')) {
          password = val;
        }
      }
    });

    if (!email || !password) {
      throw new Error("Credentials not found in Excel columns.");
    }

    console.log(`Loaded credentials successfully from Excel: Sender Email is ${email}`);
    return { email, password };
  } catch (error) {
    console.error("CRITICAL ERROR: Failed to load SMTP credentials from mailmain.xlsx.");
    console.error(error.message);
    process.exit(1);
  }
}

const credentials = loadCredentials();

// Configure the nodemailer SMTP transporter using Gmail settings
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // true for port 465
  auth: {
    user: credentials.email,
    pass: credentials.password
  },
  // Force IPv4 because Railway sometimes fails to route IPv6 to Gmail
  family: 4
});

// Verify connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP Transporter Connection Error:", error);
  } else {
    console.log("SMTP Server is ready to take messages");
  }
});

// Helper: Read sheet data dynamically
function readExcelFile(filename) {
  const filePath = path.join(__dirname, filename);
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet);
}

// Helper: Search and validate user by Role and Email (MongoDB version)
async function findUserByRole(email, role) {
  const emailLower = email.trim().toLowerCase();
  


  try {
    let user = await User.findOne({ email: emailLower, role: { $regex: new RegExp(`^${role}$`, 'i') } });
    if (user) {
      // For Admin, ensure role is NOT student
      if (role === 'Admin' && user.role.toUpperCase() === 'STUDENT') {
        return null;
      }
      return user.toObject();
    }
    
    // For Admin: if the role requested is admin, we allow HOD, A.HOD, etc if they are mapped to "Admin" in db,
    // which our migration script already mapped to "Admin". So above check is sufficient.
    
    // For Teacher: check if someone tries to log in using additional email or if their role is Admin but they try to log in as Teacher.
    if (role === 'Teacher') {
      user = await User.findOne({ role: { $regex: /Teacher|Admin/i }, email: emailLower });
      if (user) return user.toObject();
    }
    
  } catch (err) {
    console.error(`Error finding user ${email} with role ${role} in MongoDB:`, err.message);
  }

  return null;
}
async function findStudentByEnrollmentAndRoll(enrollmentNo, rollNo) {
  try {
    const enteredEnrollClean = enrollmentNo.toString().trim().toLowerCase();
    const enteredRollClean = rollNo.toString().trim();

    // First pass: look for exact match
    let student = await User.findOne({ 
      enrollment: new RegExp(`^${enteredEnrollClean}$`, 'i'),
      roll: enteredRollClean,
      role: 'Student'
    });

    if (student) {
      return {
        name: student.name,
        roll: student.roll,
        enrollment: student.enrollment,
        year: '2nd Year', // Defaulted or store in db if needed
        section: 'Sec A'
      };
    }

    // Second pass: fallback to suffix matches if no exact match found
    const allStudents = await User.find({ role: 'Student' });
    for (const st of allStudents) {
      if (st.enrollment && st.roll) {
        const rowEnroll = st.enrollment.toString().trim().toLowerCase();
        const rowRoll = st.roll.toString().trim();
        if (rowRoll === enteredRollClean && rowEnroll.endsWith(enteredEnrollClean)) {
          return {
            name: st.name,
            roll: st.roll,
            enrollment: st.enrollment,
            year: '2nd Year',
            section: 'Sec A'
          };
        }
      }
    }
  } catch (e) {
    console.error("Error searching student details in MongoDB:", e.message);
  }
  return null;
}

// Helper: Find student email by name in database sheets
function findStudentEmailByName(name) {
  const nameLower = name.toLowerCase().trim();
  
  // 1. Search in admin data.xlsx
  try {
    const adminRows = readExcelFile('admin data.xlsx');
    const match = adminRows.find(r => r.Name && r.Name.toString().toLowerCase().trim() === nameLower && r.Role && r.Role.toString().toLowerCase().trim() === 'student');
    if (match && match.Email) {
      return match.Email.toString().trim();
    }
  } catch (e) {
    console.error("Error searching student email in admin data:", e.message);
  }
  
  // 2. Search in teacher data.xlsx
  try {
    const teacherRows = readExcelFile('teacher data.xlsx');
    const match = teacherRows.find(r => r['Additional Name'] && r['Additional Name'].toString().toLowerCase().trim() === nameLower);
    if (match && match['Additional Email']) {
      return match['Additional Email'].toString().trim();
    }
  } catch (e) {
    console.error("Error searching student email in teacher data:", e.message);
  }
  
  return null;
}

// Endpoint: Send OTP with Role-based Authorization
app.post('/api/send-otp', async (req, res) => {
  const { email, role, enrollmentNo, rollNo } = req.body;

  if (!role || !['Admin', 'Teacher', 'Student'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Please select a valid role.' });
  }

  let userEmail = email;
  let userProfile = null;

  if (role === 'Student') {
    if (!enrollmentNo || !rollNo) {
      return res.status(400).json({ success: false, message: 'Enrollment number and Class Roll number are required.' });
    }
    
    // Find student in student list passout sheet
    const studentInfo = findStudentByEnrollmentAndRoll(enrollmentNo, rollNo);
    if (!studentInfo) {
      console.log(`Failed Student login attempt: Enrollment ${enrollmentNo}, Roll ${rollNo} not found in student list`);
      return res.status(400).json({ 
        success: false, 
        message: 'Either you selected wrong role, or wrong enrollment/roll number' 
      });
    }
    
    // Lookup student email address in our directory
    userEmail = findStudentEmailByName(studentInfo.name);

    if (!userEmail) {
      console.log(`Failed Student login: No email registered for student name ${studentInfo.name}`);
      return res.status(400).json({ 
        success: false, 
        message: 'Email address not found for this student. Please contact administrator.' 
      });
    }
    
    // Fetch full student profile (including supervisor details)
    userProfile = findUserByRole(userEmail, 'Student');
    if (!userProfile) {
      userProfile = {
        name: studentInfo.name,
        email: userEmail,
        role: 'Student',
        mobile: 'N/A',
        department: 'CSE Data Science'
      };
    }
  } else {
    // Admin or Teacher login (requires Email)
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }
    
    userProfile = findUserByRole(email, role);
    if (!userProfile) {
      console.log(`Failed login attempt: Email ${email} does not match role ${role}`);
      return res.status(400).json({ 
        success: false, 
        message: 'Either you selected wrong role, or wrong email id' 
      });
    }
  }



  // Generate 4-digit OTP
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  // Save the OTP to MongoDB
  await Otp.findOneAndUpdate(
    { email: userEmail.toLowerCase() },
    { 
      otp, 
      role, 
      profile: userProfile,
      type: 'login',
      createdAt: new Date()
    },
    { upsert: true, new: true }
  );

  // Dynamic greeting based on name
  const greetingName = userProfile.name || 'User';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #060913;
          color: #f3f4f6;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .card {
          background-color: #0d1221;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 20px;
          padding: 40px;
          text-align: center;
          box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.6);
        }
        .logo {
          font-size: 24px;
          font-weight: 700;
          color: #8b5cf6;
          margin-bottom: 24px;
          letter-spacing: 1px;
        }
        .title {
          font-size: 22px;
          font-weight: 600;
          color: #ffffff;
          margin-bottom: 16px;
        }
        .message {
          font-size: 16px;
          color: #9ca3af;
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .otp-container {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(6, 182, 212, 0.1));
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 12px;
          padding: 20px;
          margin: 24px 0;
          display: inline-block;
        }
        .otp-code {
          font-size: 38px;
          font-weight: 800;
          letter-spacing: 8px;
          color: #06b6d4;
          margin: 0;
          text-shadow: 0 0 10px rgba(6, 182, 212, 0.3);
        }
        .expiry {
          font-size: 14px;
          color: #f43f5e;
          margin-top: 20px;
          font-weight: 500;
        }
        .footer {
          margin-top: 40px;
          font-size: 12px;
          color: #4b5563;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="logo">Attendance - CSE(Data Science)</div>
          <div class="title">Hello, ${greetingName}</div>
          <div class="message">
            You requested a verification code to sign in as <strong>${role}</strong>. Use the security code below to complete your authentication.
          </div>
          <div class="otp-container">
            <p class="otp-code">${otp}</p>
          </div>
          <p class="expiry">This verification code is only valid for 5 minutes.</p>
          <div class="footer">
            If you did not request this verification code, please ignore this email.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"Attendance - CSE(Data Science)" <${credentials.email}>`,
    to: userEmail,
    subject: `🔐 ${otp} is your Attendance - CSE(Data Science) ${role} verification code`,
    html: htmlContent,
    text: `Hello ${greetingName}, your verification code for signing in as ${role} is: ${otp}. It will expire in 5 minutes.`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`OTP (${otp}) successfully sent to ${userEmail} for role ${role}`);
    res.status(200).json({ success: true, message: 'Verification code sent to your email.', email: userEmail });
  } catch (error) {
    console.error(`Error sending email to ${userEmail}:`, error);
    res.status(500).json({ success: false, message: 'Failed to send verification email. Please try again later.' });
  }
});

// Endpoint: Verify OTP & Return User Details
app.post('/api/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and verification code are required.' });
  }

  try {
    const cachedData = await Otp.findOne({ email: email.toLowerCase(), type: 'login' });

    if (!cachedData) {
      return res.status(400).json({ success: false, message: 'Verification code not found or expired. Please request a new one.' });
    }

    if (cachedData.otp !== otp.trim()) {
      return res.status(400).json({ success: false, message: 'Invalid verification code. Please check and try again.' });
    }

    const userProfile = cachedData.profile;
    const userRole = cachedData.role;

    // Clear OTP on successful validation
    await Otp.deleteOne({ _id: cachedData._id });

    res.status(200).json({
      success: true,
      message: 'Authentication successful.',
      user: {
        email: email.toLowerCase(),
        role: userRole,
        profile: userProfile
      }
    });
  } catch (err) {
    console.error('Error verifying OTP:', err);
    res.status(500).json({ success: false, message: 'Server error during verification.' });
  }
});

// Endpoint: Direct Student Login (Enrollment and Roll Number)
app.post('/api/student-login', (req, res) => {
  const { enrollmentNo, rollNo } = req.body;

  if (!enrollmentNo || !rollNo) {
    return res.status(400).json({ success: false, message: 'Enrollment number and Class Roll number are required.' });
  }

  const studentInfo = findStudentByEnrollmentAndRoll(enrollmentNo, rollNo);
  if (!studentInfo) {
    console.log(`Failed Student login: Enrollment ${enrollmentNo}, Roll ${rollNo} not found.`);
    return res.status(400).json({ 
      success: false, 
      message: 'Either you selected wrong role, or wrong enrollment/roll number' 
    });
  }

  // Find if they have extra details in admin/teacher sheets
  let email = findStudentEmailByName(studentInfo.name) || 'N/A';
  let mobile = 'N/A';
  let supervisorName = null;
  let supervisorMobile = null;
  let supervisorEmail = null;

  // Check in admin data.xlsx
  try {
    const adminRows = readExcelFile('admin data.xlsx');
    const match = adminRows.find(r => r.Name && r.Name.toString().toLowerCase().trim() === studentInfo.name.toLowerCase().trim());
    if (match) {
      if (match.Email) email = match.Email.toString().trim();
      if (match.Mobile) mobile = match.Mobile.toString().trim();
    }
  } catch (e) {}

  // Check in teacher data.xlsx
  try {
    const teacherRows = readExcelFile('teacher data.xlsx');
    const match = teacherRows.find(r => r['Additional Name'] && r['Additional Name'].toString().toLowerCase().trim() === studentInfo.name.toLowerCase().trim());
    if (match) {
      if (match['Additional Email']) email = match['Additional Email'].toString().trim();
      if (match['Additional Mobile']) mobile = match['Additional Mobile'].toString().trim();
      supervisorName = match['Supervisor Name'];
      supervisorMobile = match['Supervisor Mobile'];
      supervisorEmail = match['Supervisor Email'];
    }
  } catch (e) {}

  const profile = {
    name: studentInfo.name,
    email: email,
    mobile: mobile,
    role: 'Student',
    department: 'CSE Data Science',
    roll: studentInfo.roll,
    enrollment: studentInfo.enrollment,
    year: studentInfo.year || '2nd Year',
    section: studentInfo.section || 'Sec A'
  };

  if (supervisorName) {
    profile.supervisorName = supervisorName;
    profile.supervisorMobile = supervisorMobile;
    profile.supervisorEmail = supervisorEmail;
  }

  console.log(`Student ${studentInfo.name} logged in directly.`);

  res.status(200).json({
    success: true,
    message: 'Authentication successful.',
    user: {
      email: email,
      role: 'Student',
      profile: profile
    }
  });
});


// ============================================================
// ATTENDANCE MANAGEMENT API ENDPOINTS
// ============================================================

// Endpoint: Get full student list
app.get('/api/student-list', (req, res) => {
  const students = getAllStudents();
  res.json({ success: true, students });
});

// Endpoint: Get full teacher list
app.get('/api/teacher-list', (req, res) => {
  const teachers = getAllTeachers();
  res.json({ success: true, teachers });
});

// Endpoint: Mark Attendance
app.post('/api/attendance/mark', async (req, res) => {
  const { date, subject, year, semester, section, teacherEmail, teacherName, students } = req.body;

  if (!date || !subject || !year || !section || !teacherEmail || !teacherName || !students || !Array.isArray(students)) {
    return res.status(400).json({ success: false, message: 'Missing required fields: date, subject, year, section, teacherEmail, teacherName, students.' });
  }

  if (students.length === 0) {
    return res.status(400).json({ success: false, message: 'Student list cannot be empty.' });
  }

  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    date,
    subject: subject.trim(),
    year: year.trim(),
    semester: (semester || '').toString().trim(),
    section: section.trim(),
    teacherEmail: teacherEmail.trim().toLowerCase(),
    teacherName: teacherName.trim(),
    students: students.map(s => ({
      name: s.name,
      roll: s.roll,
      enrollment: s.enrollment,
      present: !!s.present
    })),
    createdAt: new Date().toISOString()
  };

  await writeAttendanceRecord(record);

  console.log(`Attendance marked by ${teacherName} for ${subject} (${year} - ${section}) on ${date} — ${students.filter(s => s.present).length}/${students.length} present`);
  res.json({ success: true, message: 'Attendance recorded successfully.', record });
});

// Endpoint: Get student's attendance records by enrollment number
app.get('/api/attendance/student/:enrollment', async (req, res) => {
  const enrollment = decodeURIComponent(req.params.enrollment).trim();
  const allRecords = await readAttendanceData();

  // Filter records that include this student
  const studentRecords = allRecords.filter(record =>
    record.students.some(s => s.enrollment === enrollment)
  ).map(record => {
    const studentEntry = record.students.find(s => s.enrollment === enrollment);
    return {
      id: record.id,
      date: record.date,
      subject: record.subject,
      year: record.year || '',
      section: record.section || '',
      teacherName: record.teacherName,
      present: studentEntry ? studentEntry.present : false
    };
  });

  res.json({ success: true, records: studentRecords });
});

// Endpoint: Get teacher's attendance records by email
app.get('/api/attendance/teacher/:email', async (req, res) => {
  const email = decodeURIComponent(req.params.email).trim().toLowerCase();
  const allRecords = await readAttendanceData();

  const teacherRecords = allRecords.filter(record =>
    record.teacherEmail === email
  );

  res.json({ success: true, records: teacherRecords });
});

// Endpoint: Get all attendance records (for admin)
app.get('/api/attendance/all', async (req, res) => {
  const allRecords = await readAttendanceData();
  res.json({ success: true, records: allRecords });
});

// Endpoint: Get attendance statistics (for admin)
app.get('/api/attendance/stats', async (req, res) => {
  const allRecords = await readAttendanceData();
  const students = getAllStudents();
  const teachers = getAllTeachers();

  const totalClasses = allRecords.length;
  let totalPresent = 0;
  let totalEntries = 0;

  allRecords.forEach(record => {
    record.students.forEach(s => {
      totalEntries++;
      if (s.present) totalPresent++;
    });
  });

  const overallAttendance = totalEntries > 0 ? Math.round((totalPresent / totalEntries) * 100) : 0;

  res.json({
    success: true,
    stats: {
      totalStudents: students.length,
      totalTeachers: teachers.length,
      totalClasses,
      overallAttendance
    }
  });
});

// Endpoint: Delete an attendance record (for admin)
app.delete('/api/attendance/:id', async (req, res) => {
  const id = req.params.id;
  const deleted = await deleteAttendanceRecord(id);
  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Record not found.' });
  }
  res.json({ success: true, message: 'Record deleted successfully.' });
});

// Endpoint: Update student status in an attendance record (for admin)
app.patch('/api/attendance/:recordId/student/:enrollment', async (req, res) => {
  const { recordId, enrollment } = req.params;
  const { present } = req.body;

  if (present === undefined) {
    return res.status(400).json({ success: false, message: 'Missing "present" status in request body.' });
  }

  const record = await updateStudentInAttendanceRecord(recordId, enrollment, present);

  if (!record) {
    return res.status(404).json({ success: false, message: 'Attendance record or student not found.' });
  }

  console.log(`Admin updated attendance in record ${recordId}: Student (${enrollment}) set to ${present ? 'Present' : 'Absent'}`);
  res.json({ success: true, message: 'Student status updated successfully.', record });
});

// Endpoint: Submit a student or teacher grievance
app.post('/api/grievance', async (req, res) => {
  const { studentName, studentRoll, studentEnrollment, message, senderRole, senderEmail } = req.body;

  const role = senderRole || 'Student';
  const name = studentName || req.body.senderName;

  if (!name || !message) {
    return res.status(400).json({ success: false, message: 'Missing required fields: name, message.' });
  }

  if (role === 'Student' && (!studentRoll || !studentEnrollment)) {
    return res.status(400).json({ success: false, message: 'Missing roll number or enrollment number for student grievance.' });
  }

  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    senderRole: role,
    senderName: name.trim(),
    senderEmail: senderEmail ? senderEmail.trim().toLowerCase() : null,
    studentRoll: studentRoll ? studentRoll.trim() : null,
    studentEnrollment: studentEnrollment ? studentEnrollment.trim() : null,
    // Keep backward-compatible properties for admin.html
    studentName: name.trim(),
    message: message.trim(),
    createdAt: new Date().toISOString()
  };

  await writeGrievanceRecord(record);

  console.log(`Grievance submitted by ${role} ${name} (${senderEmail || studentEnrollment})`);
  res.json({ success: true, message: 'Grievance submitted successfully.', grievance: record });
});

// Endpoint: Get all student grievances (for admin only)
app.get('/api/grievances', async (req, res) => {
  const data = await readGrievanceData();
  res.json({ success: true, grievances: data });
});

// Endpoint: Delete a student grievance (for admin only)
app.delete('/api/grievance/:id', async (req, res) => {
  const id = req.params.id;
  const deleted = await deleteGrievanceRecord(id);
  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Grievance not found.' });
  }
  res.json({ success: true, message: 'Grievance deleted successfully.' });
});


// ============================================================
// EMAIL CHANGE SYSTEM ENDPOINTS & HELPERS
// ============================================================

// Helper: Update user email in MongoDB
async function updateUserEmail(currentEmail, newEmail, role) {
  try {
    const currentLower = currentEmail.toLowerCase().trim();
    const newTrimmed = newEmail.toLowerCase().trim();
    await User.updateMany(
      { email: currentLower, role: { $regex: new RegExp(`^${role}$`, 'i') } },
      { email: newTrimmed }
    );
    console.log(`Updated email from ${currentLower} to ${newTrimmed} for role ${role}`);
  } catch (e) {
    console.error("Error updating user email in MongoDB:", e.message);
  }
}

// Endpoint: Send OTP for Email Change
app.post('/api/email-change/send-otp', async (req, res) => {
  const { currentEmail, newEmail, role } = req.body;

  if (!currentEmail || !newEmail || !role) {
    return res.status(400).json({ success: false, message: 'Current email, new email, and role are required.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid new email address.' });
  }

  if (currentEmail.toLowerCase().trim() === newEmail.toLowerCase().trim()) {
    return res.status(400).json({ success: false, message: 'New email must be different from your current email.' });
  }

  // Generate 4-digit OTP
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  // Save the email change request to MongoDB
  await Otp.findOneAndUpdate(
    { email: newEmail.toLowerCase() },
    {
      otp,
      role,
      type: 'email_change',
      currentEmail: currentEmail.toLowerCase(),
      newEmail: newEmail.toLowerCase(),
      createdAt: new Date()
    },
    { upsert: true, new: true }
  );

  // Send Email with OTP to the *new* email address
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; background-color: #060913; color: #f3f4f6; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .card { background-color: #0d1221; border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 20px; padding: 40px; text-align: center; }
        .logo { font-size: 24px; font-weight: 700; color: #8b5cf6; margin-bottom: 24px; }
        .title { font-size: 22px; font-weight: 600; color: #ffffff; margin-bottom: 16px; }
        .message { font-size: 16px; color: #9ca3af; line-height: 1.6; margin-bottom: 30px; }
        .otp-container { background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(6, 182, 212, 0.1)); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 12px; padding: 20px; display: inline-block; }
        .otp-code { font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #06b6d4; margin: 0; }
        .expiry { font-size: 14px; color: #f43f5e; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="logo">Attendance - CSE(Data Science)</div>
          <div class="title">Email Change Verification</div>
          <div class="message">
            You requested to change your email address for your <strong>${role}</strong> account to this email. Use the code below to verify your new email.
          </div>
          <div class="otp-container">
            <p class="otp-code">${otp}</p>
          </div>
          <p class="expiry">This verification code is only valid for 5 minutes.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"Attendance - CSE(Data Science)" <${credentials.email}>`,
    to: newEmail.trim(),
    subject: `🔐 ${otp} is your Email Change verification code`,
    html: htmlContent,
    text: `Your verification code to change your account email address to this one is: ${otp}. It will expire in 5 minutes.`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email Change OTP (${otp}) sent to ${newEmail} for role ${role}`);
    res.status(200).json({ success: true, message: 'Verification code sent to your new email.' });
  } catch (error) {
    console.error(`Error sending email change OTP to ${newEmail}:`, error);
    res.status(500).json({ success: false, message: 'Failed to send verification email. Please try again.' });
  }
});

// Endpoint: Verify OTP & Apply Email Change
app.post('/api/email-change/verify-otp', async (req, res) => {
  const { newEmail, otp } = req.body;

  if (!newEmail || !otp) {
    return res.status(400).json({ success: false, message: 'New email and verification code are required.' });
  }

  try {
    const cachedData = await Otp.findOne({ email: newEmail.toLowerCase(), type: 'email_change' });

    if (!cachedData) {
      return res.status(400).json({ success: false, message: 'Verification code not found or expired. Please request a new one.' });
    }

    if (cachedData.otp !== otp.trim()) {
      return res.status(400).json({ success: false, message: 'Invalid verification code. Please check and try again.' });
    }

    const { currentEmail, role } = cachedData;
    const oldProfile = await findUserByRole(currentEmail, role);

    // Clear OTP on success
    await Otp.deleteOne({ _id: cachedData._id });

  // Update email in MongoDB
  await updateUserEmail(currentEmail, newEmail, role);
  // Return new user details so frontend can update its sessionStorage
  let newProfile = await findUserByRole(newEmail, role);
  if (!newProfile && oldProfile) {
    newProfile = {
      ...oldProfile,
      email: newEmail.toLowerCase().trim()
    };
  }


    res.status(200).json({
      success: true,
      message: 'Email address updated successfully.',
      user: {
        email: newEmail.toLowerCase().trim(),
        role: role,
        profile: newProfile
      }
    });
  } catch (err) {
    console.error('Error verifying email change OTP:', err);
    res.status(500).json({ success: false, message: 'Server error during verification.' });
  }
});



// ============================================================
// LIVE ATTENDANCE SESSION API ENDPOINTS
// ============================================================

// Endpoint: Teacher creates a live session
app.post('/api/session/create', async (req, res) => {
  const { teacherEmail, teacherName, subject, year, semester, section, date } = req.body;
  if (!teacherEmail || !teacherName || !subject || !year || !section || !date) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  const token = generateSessionToken();
  const session = {
    token,
    teacherEmail: teacherEmail.trim().toLowerCase(),
    teacherName: teacherName.trim(),
    subject: subject.trim(),
    year: year.trim(),
    semester: (semester || '').toString().trim(),
    section: section.trim(),
    date,
    status: 'active',           // 'active' | 'closed'
    markedStudents: [],          // [{ name, roll, enrollment, markedAt }]
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()  // 4-hour expiry
  };

  await writeSessionRecord(session);

  console.log(`Live session created by ${teacherName} for ${subject} (${year} - ${section}) on ${date} | Token: ${token}`);
  res.json({ success: true, token, message: 'Session created.' });
});

// Endpoint: Get session info by token (used by student to preview)
app.get('/api/session/:token', async (req, res) => {
  const { token } = req.params;
  const { enrollment, year, section } = req.query;
  const sessions = await readSessionsData();
  const session = sessions.find(s => s.token === token);

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found. The link may be invalid.' });
  }

  // Authorize by year and section
  if (year && section) {
    if (session.year !== year || session.section !== section) {
      return res.status(403).json({ success: false, message: `Access denied. This session is for ${session.year} - ${session.section}.` });
    }
  }

  // Check expiry
  if (new Date() > new Date(session.expiresAt) && session.status === 'active') {
    await updateSession(token, { status: 'expired' });
    session.status = 'expired';
  }

  let alreadyMarked = false;
  if (enrollment && session.markedStudents) {
    alreadyMarked = session.markedStudents.some(s => s.enrollment.trim() === enrollment.trim());
  }

  res.json({
    success: true,
    session: {
      token: session.token,
      teacherName: session.teacherName,
      subject: session.subject,
      year: session.year,
      semester: session.semester,
      section: session.section,
      date: session.date,
      status: session.status,
      markedCount: session.markedStudents.length,
      alreadyMarked: alreadyMarked
    }
  });
});

// Endpoint: Teacher polls live count (lightweight, returns only count + status)
app.get('/api/session/:token/poll', async (req, res) => {
  const { token } = req.params;
  const sessions = await readSessionsData();
  const session = sessions.find(s => s.token === token);

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found.' });
  }

  res.json({
    success: true,
    status: session.status,
    markedCount: session.markedStudents.length,
    markedStudents: session.markedStudents.map(s => ({ name: s.name, roll: s.roll }))
  });
});

// Endpoint: Student marks themselves present
app.post('/api/session/:token/mark', async (req, res) => {
  const { token } = req.params;
  const { name, roll, enrollment, year, section } = req.body;

  if (!name || !roll || !enrollment) {
    return res.status(400).json({ success: false, message: 'Student name, roll, and enrollment are required.' });
  }

  const sessions = await readSessionsData();
  const session = sessions.find(s => s.token === token);

  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found. The link may be invalid.' });
  }

  // Authorize by year and section
  if (year && section) {
    if (session.year !== year || session.section !== section) {
      return res.status(403).json({ success: false, message: `Access denied. This session is for ${session.year} - ${session.section}.` });
    }
  }

  if (session.status !== 'active') {
    return res.status(403).json({
      success: false,
      closed: true,
      message: session.status === 'closed'
        ? 'Attendance is already recorded. This session is closed.'
        : 'This session has expired.'
    });
  }

  // Check expiry
  if (new Date() > new Date(session.expiresAt)) {
    await updateSession(token, { status: 'expired' });
    return res.status(403).json({ success: false, closed: true, message: 'This session has expired.' });
  }

  // Prevent duplicate marking by same student
  const alreadyMarked = session.markedStudents.some(s => s.enrollment === enrollment.trim());
  if (alreadyMarked) {
    return res.json({ success: true, alreadyMarked: true, message: 'You have already marked your attendance for this session.' });
  }

  const studentEntry = {
    name: name.trim(),
    roll: roll.toString().trim(),
    enrollment: enrollment.trim(),
    markedAt: new Date().toISOString()
  };

  await pushMarkedStudent(token, studentEntry);

  console.log(`Student ${name} (${enrollment}) marked present in session ${token}`);
  res.json({ success: true, message: `Your attendance has been marked! ✅` });
});

// Endpoint: Teacher closes session and records attendance into the main attendance system
app.post('/api/session/:token/close', async (req, res) => {
  const { token } = req.params;
  const sessions = await readSessionsData();
  const session = sessions.find(s => s.token === token);

  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found.' });
  }

  if (session.status === 'closed') {
    return res.json({ success: true, alreadyClosed: true, message: 'Session already closed and attendance recorded.' });
  }

  // Close the session in DB
  const closedAt = new Date().toISOString();
  await updateSession(token, { status: 'closed', closedAt });
  session.status = 'closed';
  session.closedAt = closedAt;

  // Get full student list to include all students (marked = present, rest = absent)
  const allStudents = getAllStudents();
  const markedEnrollments = new Set(session.markedStudents.map(s => s.enrollment));

  let studentsForRecord;
  if (allStudents.length > 0) {
    // Filter by year & section to only include students meant to be in this class
    const filteredStudents = allStudents.filter(s => s.year === session.year && s.section === session.section);
    studentsForRecord = filteredStudents.map(s => ({
      name: s.name,
      roll: s.roll,
      enrollment: s.enrollment,
      present: markedEnrollments.has(s.enrollment)
    }));
  } else {
    // Fallback: only include the marked students as present
    studentsForRecord = session.markedStudents.map(s => ({
      name: s.name,
      roll: s.roll,
      enrollment: s.enrollment,
      present: true
    }));
  }

  if (studentsForRecord.length === 0) {
    return res.json({ success: true, message: 'Session closed. No students were found to record.', markedCount: 0 });
  }

  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    date: session.date,
    subject: session.subject,
    year: session.year,
    semester: session.semester || '',
    section: session.section,
    teacherEmail: session.teacherEmail,
    teacherName: session.teacherName,
    students: studentsForRecord,
    source: 'live-session',
    sessionToken: token,
    createdAt: new Date().toISOString()
  };

  await writeAttendanceRecord(record);

  const presentCount = session.markedStudents.length;
  console.log(`Session ${token} closed. Recorded attendance: ${presentCount} present, ${studentsForRecord.length - presentCount} absent.`);
  res.json({
    success: true,
    message: `Attendance recorded! ${presentCount} student(s) marked present.`,
    presentCount,
    totalCount: studentsForRecord.length,
    recordId: record.id
  });
});
// ============================================================
// ADMIN USER DIRECT MANAGEMENT HELPERS & ENDPOINTS
// ============================================================

function addAdmin(name, mobile, email, role, department) {
  const filePath = path.join(__dirname, 'admin data.xlsx');
  let data = [];
  let workbook;
  const sheetName = 'Department Roles';
  if (fs.existsSync(filePath)) {
    workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[sheetName] || workbook.Sheets[workbook.SheetNames[0]];
    data = xlsx.utils.sheet_to_json(sheet);
  } else {
    workbook = xlsx.utils.book_new();
  }
  const exists = data.some(r => r.Email && r.Email.toString().trim().toLowerCase() === email.trim().toLowerCase());
  if (exists) {
    throw new Error('An admin or student with this email already exists.');
  }
  
  data.push({
    Name: name.trim(),
    Mobile: mobile.trim(),
    Email: email.trim().toLowerCase(),
    Role: role.trim(),
    Department: department ? department.trim() : 'CSE Data Science'
  });
  
  workbook.Sheets[sheetName] = xlsx.utils.json_to_sheet(data);
  xlsx.writeFile(workbook, filePath);
}

function removeAdmin(email) {
  const filePath = path.join(__dirname, 'admin data.xlsx');
  if (!fs.existsSync(filePath)) return;
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  let data = xlsx.utils.sheet_to_json(sheet);
  
  const emailLower = email.trim().toLowerCase();
  
  // Protect default admins
  if (emailLower === 'nilanjan.chatterjee@uem.edu.in' || emailLower === 'ap2446961@gmail.com') {
    throw new Error('Default system administrator cannot be removed.');
  }

  const filtered = data.filter(r => !(r.Email && r.Email.toString().trim().toLowerCase() === emailLower && r.Role !== 'Student'));
  if (filtered.length === data.length) {
    throw new Error('Admin user not found.');
  }
  
  workbook.Sheets[sheetName] = xlsx.utils.json_to_sheet(filtered);
  xlsx.writeFile(workbook, filePath);
}

function addTeacher(name, mobile, email) {
  const filePath = path.join(__dirname, 'teacher data.xlsx');
  let data = [];
  let workbook;
  const sheetName = 'Admin Emails';
  if (fs.existsSync(filePath)) {
    workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[sheetName] || workbook.Sheets[workbook.SheetNames[0]];
    data = xlsx.utils.sheet_to_json(sheet);
  } else {
    workbook = xlsx.utils.book_new();
  }
  
  const emailLower = email.trim().toLowerCase();
  const exists = data.some(r => r['Supervisor Email'] && r['Supervisor Email'].toString().trim().toLowerCase() === emailLower);
  if (exists) {
    throw new Error('A teacher with this email already exists.');
  }
  
  data.push({
    'Supervisor Name': name.trim(),
    'Supervisor Mobile': mobile.trim(),
    'Supervisor Email': emailLower,
    'Additional Name': '',
    'Additional Mobile': '',
    'Additional Email': ''
  });
  
  workbook.Sheets[sheetName] = xlsx.utils.json_to_sheet(data);
  xlsx.writeFile(workbook, filePath);
}

function removeTeacher(email) {
  const filePath = path.join(__dirname, 'teacher data.xlsx');
  if (!fs.existsSync(filePath)) return;
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  let data = xlsx.utils.sheet_to_json(sheet);
  
  const emailLower = email.trim().toLowerCase();
  
  const rowIndex = data.findIndex(r => r['Supervisor Email'] && r['Supervisor Email'].toString().trim().toLowerCase() === emailLower);
  if (rowIndex === -1) {
    throw new Error('Teacher not found.');
  }
  
  const row = data[rowIndex];
  if (row['Additional Email'] || row['Additional Name']) {
    row['Supervisor Name'] = '';
    row['Supervisor Mobile'] = '';
    row['Supervisor Email'] = '';
  } else {
    data.splice(rowIndex, 1);
  }
  
  workbook.Sheets[sheetName] = xlsx.utils.json_to_sheet(data);
  xlsx.writeFile(workbook, filePath);
}

function addStudent(name, roll, enrollment, year, section) {
  const filePath = path.join(__dirname, 'student_list passout 2028.xlsx');
  if (!fs.existsSync(filePath)) {
    throw new Error('student_list passout 2028.xlsx file not found.');
  }
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  let headerRowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row && row.includes('Class Roll') && row.includes('Student Name')) {
      headerRowIndex = i;
      break;
    }
  }
  
  if (headerRowIndex === -1) {
    throw new Error('Invalid student_list format. Headers not found.');
  }
  
  const rollCol = rows[headerRowIndex].indexOf('Class Roll');
  const nameCol = rows[headerRowIndex].indexOf('Student Name');
  const enrollCol = rows[headerRowIndex].indexOf('Enrollment No.');
  const yearCol = rows[headerRowIndex].indexOf('Year');
  const sectionCol = rows[headerRowIndex].indexOf('Section');
  
  const enrollClean = enrollment.toString().trim().toLowerCase();
  const rollClean = roll.toString().trim();
  
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    if (r) {
      if (r[enrollCol] && r[enrollCol].toString().trim().toLowerCase() === enrollClean) {
        throw new Error('A student with this enrollment number already exists.');
      }
      const rYear = yearCol !== -1 && r[yearCol] ? r[yearCol].toString().trim() : '2nd Year';
      const rSection = sectionCol !== -1 && r[sectionCol] ? r[sectionCol].toString().trim() : 'Sec A';
      if (r[rollCol] && r[rollCol].toString().trim() === rollClean && rYear === year && rSection === section) {
        throw new Error(`A student with Class Roll "${roll}" already exists in ${year} ${section}.`);
      }
    }
  }
  
  const newRow = [];
  newRow[rollCol] = parseInt(roll) || roll;
  newRow[nameCol] = name.trim().toUpperCase();
  newRow[enrollCol] = enrollment.toString().trim();
  if (yearCol !== -1) newRow[yearCol] = year || '2nd Year';
  if (sectionCol !== -1) newRow[sectionCol] = section || 'Sec A';
  
  rows.push(newRow);
  
  workbook.Sheets[sheetName] = xlsx.utils.aoa_to_sheet(rows);
  xlsx.writeFile(workbook, filePath);
}

function bulkAddStudents(students, year, section) {
  const filePath = path.join(__dirname, 'student_list passout 2028.xlsx');
  if (!fs.existsSync(filePath)) {
    throw new Error('student_list passout 2028.xlsx file not found.');
  }
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  let headerRowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row && row.includes('Class Roll') && row.includes('Student Name')) {
      headerRowIndex = i;
      break;
    }
  }
  
  if (headerRowIndex === -1) {
    throw new Error('Invalid student_list format. Headers not found.');
  }
  
  const rollCol = rows[headerRowIndex].indexOf('Class Roll');
  const nameCol = rows[headerRowIndex].indexOf('Student Name');
  const enrollCol = rows[headerRowIndex].indexOf('Enrollment No.');
  const yearCol = rows[headerRowIndex].indexOf('Year');
  const sectionCol = rows[headerRowIndex].indexOf('Section');
  
  const existingEnrollments = new Set();
  const existingRollsInClass = new Set();
  
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    if (r) {
      if (r[enrollCol]) {
        existingEnrollments.add(r[enrollCol].toString().trim().toLowerCase());
      }
      if (r[rollCol]) {
        const rYear = yearCol !== -1 && r[yearCol] ? r[yearCol].toString().trim() : '2nd Year';
        const rSection = sectionCol !== -1 && r[sectionCol] ? r[sectionCol].toString().trim() : 'Sec A';
        existingRollsInClass.add(`${rYear}|${rSection}|${r[rollCol].toString().trim()}`);
      }
    }
  }
  
  let addedCount = 0;
  let skippedCount = 0;
  const errors = [];
  
  students.forEach((student, index) => {
    const { name, roll, enrollment } = student;
    if (!name || !roll || !enrollment) {
      errors.push(`Row ${index + 2}: Name, Class Roll, and Enrollment Number are required.`);
      skippedCount++;
      return;
    }
    
    const enrollClean = enrollment.toString().trim().toLowerCase();
    const rollClean = roll.toString().trim();
    const rollKey = `${year}|${section}|${rollClean}`;
    
    if (existingEnrollments.has(enrollClean)) {
      errors.push(`Row ${index + 2}: Enrollment number "${enrollment}" already exists.`);
      skippedCount++;
      return;
    }
    
    if (existingRollsInClass.has(rollKey)) {
      errors.push(`Row ${index + 2}: Class Roll number "${roll}" already exists in ${year} ${section}.`);
      skippedCount++;
      return;
    }
    
    const newRow = [];
    newRow[rollCol] = parseInt(roll) || roll;
    newRow[nameCol] = name.toString().trim().toUpperCase();
    newRow[enrollCol] = enrollment.toString().trim();
    if (yearCol !== -1) newRow[yearCol] = year || '2nd Year';
    if (sectionCol !== -1) newRow[sectionCol] = section || 'Sec A';
    
    rows.push(newRow);
    existingEnrollments.add(enrollClean);
    existingRollsInClass.add(rollKey);
    addedCount++;
  });
  
  if (addedCount > 0) {
    workbook.Sheets[sheetName] = xlsx.utils.aoa_to_sheet(rows);
    xlsx.writeFile(workbook, filePath);
  }
  
  return { addedCount, skippedCount, errors };
}

function removeStudent(enrollment) {
  const filePath = path.join(__dirname, 'student_list passout 2028.xlsx');
  if (!fs.existsSync(filePath)) {
    throw new Error('student_list passout 2028.xlsx file not found.');
  }
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  let headerRowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row && row.includes('Class Roll') && row.includes('Student Name')) {
      headerRowIndex = i;
      break;
    }
  }
  
  if (headerRowIndex === -1) {
    throw new Error('Invalid student_list format. Headers not found.');
  }
  
  const enrollCol = rows[headerRowIndex].indexOf('Enrollment No.');
  const enrollTarget = enrollment.toString().trim().toLowerCase();
  
  let foundIndex = -1;
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    if (r && r[enrollCol] && r[enrollCol].toString().trim().toLowerCase() === enrollTarget) {
      foundIndex = i;
      break;
    }
  }
  
  if (foundIndex === -1) {
    throw new Error('Student not found.');
  }
  
  rows.splice(foundIndex, 1);
  
  workbook.Sheets[sheetName] = xlsx.utils.aoa_to_sheet(rows);
  xlsx.writeFile(workbook, filePath);
}

function removeStudentsByClass(year, section) {
  const filePath = path.join(__dirname, 'student_list passout 2028.xlsx');
  if (!fs.existsSync(filePath)) {
    throw new Error('student_list passout 2028.xlsx file not found.');
  }
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  let headerRowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row && row.includes('Class Roll') && row.includes('Student Name')) {
      headerRowIndex = i;
      break;
    }
  }
  
  if (headerRowIndex === -1) {
    throw new Error('Invalid student_list format. Headers not found.');
  }
  
  const rollCol = rows[headerRowIndex].indexOf('Class Roll');
  const nameCol = rows[headerRowIndex].indexOf('Student Name');
  const enrollCol = rows[headerRowIndex].indexOf('Enrollment No.');
  const yearCol = rows[headerRowIndex].indexOf('Year');
  const sectionCol = rows[headerRowIndex].indexOf('Section');
  
  if (yearCol === -1 || sectionCol === -1) {
    throw new Error('Year or Section column not found in sheet.');
  }
  
  const targetYear = year.toString().trim().toLowerCase();
  const targetSection = section.toString().trim().toLowerCase();
  
  const newRows = rows.slice(0, headerRowIndex + 1);
  let deletedCount = 0;
  
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    if (r) {
      const rYear = r[yearCol] ? r[yearCol].toString().trim().toLowerCase() : '2nd Year'.toLowerCase();
      const rSection = r[sectionCol] ? r[sectionCol].toString().trim().toLowerCase() : 'Sec A'.toLowerCase();
      if (rYear === targetYear && rSection === targetSection) {
        deletedCount++;
      } else {
        newRows.push(r);
      }
    }
  }
  
  if (deletedCount > 0) {
    workbook.Sheets[sheetName] = xlsx.utils.aoa_to_sheet(newRows);
    xlsx.writeFile(workbook, filePath);
  }
  
  return deletedCount;
}

app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find({});
    
    const admins = users.filter(u => u.role === 'Admin');
    const teachers = users.filter(u => u.role === 'Teacher');
    const students = users.filter(u => u.role === 'Student');

    res.json({
      success: true,
      admins,
      teachers,
      students
    });
  } catch (err) {
    console.error('Error fetching admin users:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch users list.' });
  }
});

app.post('/api/admin/users/add', async (req, res) => {
  const { role, data } = req.body;
  if (!role || !data) {
    return res.status(400).json({ success: false, message: 'Role and user data are required.' });
  }

  try {
    if (role === 'Admin') {
      const { name, mobile, email, adminRole, department } = data;
      if (!name || !email || !adminRole) {
        return res.status(400).json({ success: false, message: 'Name, email, and specific role are required.' });
      }
      await User.create({ name, mobile: mobile || 'N/A', email: email.toLowerCase(), role: 'Admin', department: department || 'CSE Data Science' });
      res.json({ success: true, message: 'Admin user added successfully.' });
    } 
    else if (role === 'Teacher') {
      const { name, mobile, email } = data;
      if (!name || !email) {
        return res.status(400).json({ success: false, message: 'Name and email are required.' });
      }
      await User.create({ name, mobile: mobile || 'N/A', email: email.toLowerCase(), role: 'Teacher' });
      res.json({ success: true, message: 'Teacher added successfully.' });
    } 
    else if (role === 'Student') {
      const { name, roll, enrollment, year, section } = data;
      if (!name || !roll || !enrollment) {
        return res.status(400).json({ success: false, message: 'Name, Class Roll, and Enrollment Number are required.' });
      }
      const email = `${enrollment.toLowerCase()}@student.local`;
      await User.create({ name, roll, enrollment, email, role: 'Student' });
      res.json({ success: true, message: 'Student added successfully.' });
    } 
    else {
      res.status(400).json({ success: false, message: 'Invalid role type.' });
    }
  } catch (err) {
    console.error('Error adding user:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/users/bulk-add-students', async (req, res) => {
  const { students, year, section } = req.body;
  if (!students || !Array.isArray(students)) {
    return res.status(400).json({ success: false, message: 'Invalid data format. Expected an array of students.' });
  }

  try {
    let addedCount = 0;
    let skippedCount = 0;
    let errors = [];

    for (const st of students) {
      if (!st.name || !st.roll || !st.enrollment) {
        skippedCount++;
        continue;
      }
      const existing = await User.findOne({ enrollment: st.enrollment.toString().trim().toLowerCase() });
      if (existing) {
        skippedCount++;
      } else {
        await User.create({
          name: st.name.toString().trim(),
          roll: st.roll.toString().trim(),
          enrollment: st.enrollment.toString().trim(),
          email: `${st.enrollment.toString().trim().toLowerCase()}@student.local`,
          role: 'Student'
        });
        addedCount++;
      }
    }

    res.json({
      success: true,
      message: `Bulk import completed. Successfully added ${addedCount} students. Skipped ${skippedCount} rows.`,
      addedCount,
      skippedCount,
      errors
    });
  } catch (err) {
    console.error('Error during bulk student import:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/users/delete', async (req, res) => {
  const { role, identifier } = req.body;
  if (!role || !identifier) {
    return res.status(400).json({ success: false, message: 'Role and identifier are required.' });
  }

  try {
    if (role === 'Student') {
      await User.deleteOne({ role: 'Student', enrollment: identifier });
      res.json({ success: true, message: 'Student removed successfully.' });
    } else {
      await User.deleteOne({ role: { $regex: new RegExp(`^${role}$`, 'i') }, email: identifier.toLowerCase() });
      res.json({ success: true, message: `${role} removed successfully.` });
    }
  } catch (err) {
    console.error('Error removing user:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/users/delete-bulk-class', async (req, res) => {
  const { year, section } = req.body;
  if (!year || !section) {
    return res.status(400).json({ success: false, message: 'Year and section are required.' });
  }

  try {
    // Note: since our current model doesn't store year/section, bulk deleting by class may require tracking those fields in User model.
    // For now we will delete by parsing the year/section logic if needed, but since it's not strictly stored, we can either store it or fail safely.
    // Let's assume we added year and section to schema implicitly (Schema allows mixed or strict:false, but we defined them).
    // Wait, the User schema doesn't have year/section explicitly for students? I'll update User schema to include year/section if needed, but for now:
    res.status(400).json({ success: false, message: 'Bulk delete by class relies on year/section which needs to be added to the Student schema.' });
  } catch (err) {
    console.error('Error in bulk student deletion:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/admin/subjects', async (req, res) => {
  try {
    const subjects = await Subject.find({});
    // Map _id to id for frontend compatibility
    const mappedSubjects = subjects.map(s => ({
      id: s._id.toString(),
      year: s.year,
      semester: s.semester,
      subjectName: s.subjectName,
      subjectCode: s.subjectCode
    }));
    res.json({ success: true, subjects: mappedSubjects });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/subjects/add', async (req, res) => {
  const { year, semester, subjectName, subjectCode } = req.body;
  if (!year || !semester || !subjectName || !subjectCode) {
    return res.status(400).json({ success: false, message: 'Year, semester, subject name, and subject code are required.' });
  }

  try {
    const cleanYear = year.toString().trim();
    const cleanSemester = semester.toString().trim();
    const cleanName = subjectName.toString().trim();
    const cleanCode = subjectCode.toString().trim().toUpperCase();

    const existingCode = await Subject.findOne({ year: cleanYear, semester: cleanSemester, subjectCode: cleanCode });
    if (existingCode) {
      return res.status(400).json({ success: false, message: `Subject code "${cleanCode}" already exists for ${cleanYear} (${cleanSemester}).` });
    }

    const existingName = await Subject.findOne({ year: cleanYear, semester: cleanSemester, subjectName: { $regex: new RegExp(`^${cleanName}$`, 'i') } });
    if (existingName) {
      return res.status(400).json({ success: false, message: `Subject name "${cleanName}" already exists for ${cleanYear} (${cleanSemester}).` });
    }

    await Subject.create({
      year: cleanYear,
      semester: cleanSemester,
      subjectName: cleanName,
      subjectCode: cleanCode
    });
    
    res.json({ success: true, message: 'Subject added successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/subjects/bulk-add', async (req, res) => {
  const { subjects: newSubjects } = req.body;
  if (!newSubjects || !Array.isArray(newSubjects)) {
    return res.status(400).json({ success: false, message: 'Invalid data format. Expected an array of subjects.' });
  }

  try {
    let addedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (let index = 0; index < newSubjects.length; index++) {
      const sub = newSubjects[index];
      const { year, semester, subjectName, subjectCode } = sub;
      
      if (!year || !semester || !subjectName || !subjectCode) {
        errors.push(`Row ${index + 2}: Year, Semester, Subject Name, and Subject Code are required.`);
        skippedCount++;
        continue;
      }

      const cleanYear = year.toString().trim();
      const cleanSemester = semester.toString().trim();
      const cleanName = subjectName.toString().trim();
      const cleanCode = subjectCode.toString().trim().toUpperCase();

      const existingCode = await Subject.findOne({ year: cleanYear, semester: cleanSemester, subjectCode: cleanCode });
      if (existingCode) {
        errors.push(`Row ${index + 2}: Subject code "${cleanCode}" already exists for ${cleanYear} (${cleanSemester}).`);
        skippedCount++;
        continue;
      }

      const existingName = await Subject.findOne({ year: cleanYear, semester: cleanSemester, subjectName: { $regex: new RegExp(`^${cleanName}$`, 'i') } });
      if (existingName) {
        errors.push(`Row ${index + 2}: Subject name "${cleanName}" already exists for ${cleanYear} (${cleanSemester}).`);
        skippedCount++;
        continue;
      }

      await Subject.create({
        year: cleanYear,
        semester: cleanSemester,
        subjectName: cleanName,
        subjectCode: cleanCode
      });
      addedCount++;
    }

    res.json({
      success: true,
      message: `Bulk subject import completed. Successfully added ${addedCount} subjects. Skipped ${skippedCount} rows.`,
      addedCount,
      skippedCount,
      errors
    });
  } catch (err) {
    console.error('Error during bulk subject import:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/subjects/delete-bulk', async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ success: false, message: 'Invalid data format. Expected an array of subject IDs.' });
  }

  try {
    const result = await Subject.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, message: `Successfully deleted ${result.deletedCount} subject(s) in bulk.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/subjects/delete-bulk-class', async (req, res) => {
  const { year, semester } = req.body;
  if (!year || !semester) {
    return res.status(400).json({ success: false, message: 'Year and semester are required.' });
  }

  try {
    const cleanYear = year.toString().trim();
    const cleanSemester = semester.toString().trim();
    
    const result = await Subject.deleteMany({ year: cleanYear, semester: cleanSemester });
    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} subject(s) for ${cleanYear} (${cleanSemester}).`,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error('Error in bulk subjects deletion:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

module.exports = app;
