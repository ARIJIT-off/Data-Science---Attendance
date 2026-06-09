const express = require('express');
const nodemailer = require('nodemailer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

// Attendance data file path
const ATTENDANCE_FILE = path.join(__dirname, 'attendance_data.json');

// Grievances data file path
const GRIEVANCES_FILE = path.join(__dirname, 'grievances.json');

// Live attendance sessions file path
const SESSIONS_FILE = path.join(__dirname, 'sessions_data.json');

// Helper: Read sessions data
function readSessionsData() {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) {
      fs.writeFileSync(SESSIONS_FILE, '[]', 'utf8');
      return [];
    }
    const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    console.error('Error reading sessions data:', e.message);
    return [];
  }
}

// Helper: Write sessions data
function writeSessionsData(data) {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing sessions data:', e.message);
  }
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

// Helper: Read grievances data from JSON file
function readGrievanceData() {
  try {
    if (!fs.existsSync(GRIEVANCES_FILE)) {
      fs.writeFileSync(GRIEVANCES_FILE, '[]', 'utf8');
      return [];
    }
    const raw = fs.readFileSync(GRIEVANCES_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    console.error('Error reading grievances data:', e.message);
    return [];
  }
}

// Helper: Write grievances data to JSON file
function writeGrievanceData(data) {
  try {
    fs.writeFileSync(GRIEVANCES_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing grievances data:', e.message);
  }
}


// Helper: Read attendance data from JSON file
function readAttendanceData() {
  try {
    if (!fs.existsSync(ATTENDANCE_FILE)) {
      fs.writeFileSync(ATTENDANCE_FILE, '[]', 'utf8');
      return [];
    }
    const raw = fs.readFileSync(ATTENDANCE_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    console.error('Error reading attendance data:', e.message);
    return [];
  }
}

// Helper: Write attendance data to JSON file
function writeAttendanceData(data) {
  try {
    fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing attendance data:', e.message);
  }
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

    const students = [];
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (row && row[rollCol] !== undefined && row[rollCol] !== null && row[nameCol]) {
        students.push({
          roll: row[rollCol].toString().trim(),
          name: row[nameCol].toString().trim(),
          enrollment: row[enrollCol] ? row[enrollCol].toString().trim() : ''
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
const otpCache = new Map();

// Helper: load SMTP / Resend credentials from environment variables or mailmain.xlsx
function loadCredentials() {
  const envEmail = process.env.EMAIL_USER;
  const envPass = process.env.EMAIL_PASS;
  const envResendKey = process.env.RESEND_API_KEY;
  const envSenderEmail = process.env.SENDER_EMAIL;
  const envMongoUri = process.env.MONGODB_URI;

  let credentials = {
    email: envEmail || null,
    password: envPass || null,
    resendKey: envResendKey || null,
    senderEmail: envSenderEmail || null,
    mongodbUri: envMongoUri || null
  };

  // If env variables are set, use them
  if ((credentials.email && credentials.password) || credentials.resendKey || credentials.mongodbUri) {
    console.log("Loaded credentials from Environment Variables.");
  }

  // Fallback to mailmain.xlsx
  try {
    const filePath = path.join(__dirname, 'mailmain.xlsx');
    if (fs.existsSync(filePath)) {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      
      data.forEach(row => {
        if (row && row[0] && row[1]) {
          const field = row[0].toString().trim().toLowerCase();
          const val = row[1].toString().trim();
          if (field.includes('email') && !field.includes('sender')) {
            credentials.email = val;
          } else if (field.includes('password') || field.includes('app password')) {
            credentials.password = val;
          } else if (field.includes('resend key') || field.includes('resend api key')) {
            credentials.resendKey = val;
          } else if (field.includes('sender email')) {
            credentials.senderEmail = val;
          } else if (field.includes('mongodb uri') || field.includes('mongodb_uri') || field.includes('mongo uri')) {
            credentials.mongodbUri = val;
          }
        }
      });
      console.log("Loaded credentials from mailmain.xlsx successfully.");
    }
  } catch (error) {
    console.warn("Could not read credentials from mailmain.xlsx:", error.message);
  }

  return credentials;
}

const credentials = loadCredentials();

// Configure the nodemailer SMTP transporter using Gmail settings if available
let transporter = null;
if (credentials.email && credentials.password) {
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // true for port 465
    auth: {
      user: credentials.email,
      pass: credentials.password
    }
  });

  // Verify connection configuration
  transporter.verify((error, success) => {
    if (error) {
      console.error("SMTP Transporter Connection Error:", error);
    } else {
      console.log("SMTP Server is ready to take messages");
    }
  });
} else {
  console.log("SMTP configuration skipped (credentials missing).");
}

const https = require('https');

// Helper: Unified send email function (supports Resend API & NodeMailer SMTP fallback)
async function sendVerificationEmail(toEmail, subject, htmlContent, textContent) {
  const resendKey = credentials.resendKey || process.env.RESEND_API_KEY;
  
  if (resendKey) {
    // Determine sender email for Resend
    let fromEmail = credentials.senderEmail || process.env.SENDER_EMAIL || 'onboarding@resend.dev';
    
    // Add display name
    const fromHeader = `"Attendance - CSE(Data Science)" <${fromEmail}>`;
    
    console.log(`Sending email to ${toEmail} using Resend REST API (From: ${fromEmail})...`);
    
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        from: fromHeader,
        to: [toEmail],
        subject: subject,
        html: htmlContent,
        text: textContent
      });

      const options = {
        hostname: 'api.resend.com',
        port: 443,
        path: '/emails',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`Email successfully sent to ${toEmail} via Resend.`);
            resolve({ success: true });
          } else {
            reject(new Error(`Resend API returned status ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (e) => reject(e));
      req.write(postData);
      req.end();
    });
  } else if (transporter) {
    console.log(`Sending email to ${toEmail} using SMTP (From: ${credentials.email})...`);
    const mailOptions = {
      from: `"Attendance - CSE(Data Science)" <${credentials.email}>`,
      to: toEmail,
      subject: subject,
      html: htmlContent,
      text: textContent
    };
    await transporter.sendMail(mailOptions);
    console.log(`Email successfully sent to ${toEmail} via SMTP.`);
    return { success: true };
  } else {
    throw new Error("No email credentials configured (neither SMTP nor Resend API key is available).");
  }
}

// Helper: Read sheet data dynamically
function readExcelFile(filename) {
  const filePath = path.join(__dirname, filename);
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet);
}

const mongoose = require('mongoose');

// MongoDB Models
const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  roll: { type: String, required: true },
  enrollment: { type: String, required: true, unique: true, index: true },
  email: { type: String },
  mobile: { type: String },
  supervisorName: { type: String },
  supervisorMobile: { type: String },
  supervisorEmail: { type: String },
  profilePic: { type: String } // Base64 string
});
const Student = mongoose.model('Student', studentSchema);

const teacherSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  mobile: { type: String },
  additionalName: { type: String },
  additionalMobile: { type: String },
  additionalEmail: { type: String },
  profilePic: { type: String } // Base64 string
});
const Teacher = mongoose.model('Teacher', teacherSchema);

const adminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  mobile: { type: String },
  role: { type: String, required: true },
  department: { type: String, default: 'CSE Data Science' },
  profilePic: { type: String } // Base64 string
});
const Admin = mongoose.model('Admin', adminSchema);

const attendanceSchema = new mongoose.Schema({
  id: { type: String, unique: true, sparse: true, index: true },
  date: { type: String, required: true },
  subject: { type: String, required: true },
  year: { type: String },
  section: { type: String },
  teacherEmail: { type: String },
  teacherName: { type: String },
  source: { type: String, default: 'manual' }, // manual, excel, live-session
  sessionToken: { type: String },
  students: [{
    name: { type: String, required: true },
    roll: { type: String, required: true },
    enrollment: { type: String, required: true },
    present: { type: Boolean, required: true }
  }],
  createdAt: { type: Date, default: Date.now }
});
const Attendance = mongoose.model('Attendance', attendanceSchema);

const liveSessionSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true, index: true },
  teacherEmail: { type: String, required: true },
  teacherName: { type: String, required: true },
  subject: { type: String, required: true },
  year: { type: String },
  section: { type: String },
  date: { type: String, required: true },
  status: { type: String, default: 'active' }, // active, closed, expired
  markedStudents: [{
    name: { type: String, required: true },
    roll: { type: String, required: true },
    enrollment: { type: String, required: true },
    markedAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  closedAt: { type: Date }
});
const LiveSession = mongoose.model('LiveSession', liveSessionSchema);

const grievanceSchema = new mongoose.Schema({
  id: { type: String, unique: true, sparse: true, index: true },
  senderName: { type: String, required: true },
  senderEmail: { type: String },
  studentRoll: { type: String },
  studentEnrollment: { type: String },
  senderRole: { type: String, required: true }, // Student or Teacher
  studentName: { type: String }, // duplicate for frontend compatibility
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Grievance = mongoose.model('Grievance', grievanceSchema);

// Connection logic
const MONGODB_URI = process.env.MONGODB_URI || credentials.mongodbUri || 'mongodb+srv://noreplyuemkattendance_db_user:Xuelk1U1ZC0wBMEt@cluster0.1qgvtim.mongodb.net/attendance?retryWrites=true&w=majority';
if (MONGODB_URI) {
  console.log("Connecting to MongoDB Atlas...");
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log("Connected to MongoDB Atlas successfully!");
      seedRosters();
    })
    .catch(err => {
      console.error("MongoDB Atlas connection error:", err.message);
      console.log("Falling back to local file/Excel operations.");
    });
} else {
  console.log("MONGODB_URI not found in env or mailmain.xlsx. Running in local file/Excel fallback mode.");
}

async function seedRosters() {
  try {
    // 1. Seed Students
    const studentCount = await Student.countDocuments();
    if (studentCount === 0) {
      console.log("Database Student collection is empty. Seeding from Excel/Directory data...");
      const studentsList = getAllStudents();
      if (studentsList.length > 0) {
        const fullStudents = studentsList.map(s => {
          let email = 'N/A';
          let mobile = 'N/A';
          let supervisorName = null;
          let supervisorMobile = null;
          let supervisorEmail = null;
          
          try {
            const adminRows = readExcelFile('admin data.xlsx');
            const match = adminRows.find(r => r.Name && r.Name.toString().toLowerCase().trim() === s.name.toLowerCase().trim());
            if (match) {
              if (match.Email) email = match.Email.toString().trim();
              if (match.Mobile) mobile = match.Mobile.toString().trim();
            }
          } catch (e) {}

          try {
            const teacherRows = readExcelFile('teacher data.xlsx');
            const match = teacherRows.find(r => r['Additional Name'] && r['Additional Name'].toString().toLowerCase().trim() === s.name.toLowerCase().trim());
            if (match) {
              if (match['Additional Email']) email = match['Additional Email'].toString().trim();
              if (match['Additional Mobile']) mobile = match['Additional Mobile'].toString().trim();
              supervisorName = match['Supervisor Name'];
              supervisorMobile = match['Supervisor Mobile'];
              supervisorEmail = match['Supervisor Email'];
            }
          } catch (e) {}

          return {
            name: s.name,
            roll: s.roll,
            enrollment: s.enrollment,
            email: email,
            mobile: mobile,
            supervisorName: supervisorName || undefined,
            supervisorMobile: supervisorMobile || undefined,
            supervisorEmail: supervisorEmail || undefined
          };
        });
        await Student.insertMany(fullStudents);
        console.log(`Successfully seeded ${fullStudents.length} students into MongoDB.`);
      }
    }

    // 2. Seed Teachers
    const teacherCount = await Teacher.countDocuments();
    if (teacherCount === 0) {
      console.log("Database Teacher collection is empty. Seeding from Excel data...");
      const rows = readExcelFile('teacher data.xlsx');
      const uniqueTeachers = [];
      const seen = new Set();
      rows.forEach(r => {
        if (r['Supervisor Name'] && r['Supervisor Email']) {
          const email = r['Supervisor Email'].toString().trim().toLowerCase();
          if (!seen.has(email)) {
            seen.add(email);
            uniqueTeachers.push({
              name: r['Supervisor Name'].toString().trim(),
              email: email,
              mobile: r['Supervisor Mobile'] ? r['Supervisor Mobile'].toString().trim() : 'N/A',
              additionalName: r['Additional Name'] || null,
              additionalMobile: r['Additional Mobile'] || null,
              additionalEmail: r['Additional Email'] || null
            });
          }
        }
      });
      if (uniqueTeachers.length > 0) {
        await Teacher.insertMany(uniqueTeachers);
        console.log(`Successfully seeded ${uniqueTeachers.length} teachers into MongoDB.`);
      }
    }

    // 3. Seed Admins
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      console.log("Database Admin collection is empty. Seeding from Excel data...");
      const filePath = path.join(__dirname, 'admin data.xlsx');
      if (fs.existsSync(filePath)) {
        const rows = readExcelFile('admin data.xlsx');
        const admins = rows
          .filter(r => r.Role && r.Role.toString().trim().toUpperCase() !== 'STUDENT')
          .map(r => ({
            name: r.Name,
            mobile: r.Mobile ? r.Mobile.toString() : 'N/A',
            email: r.Email ? r.Email.toString().trim().toLowerCase() : '',
            role: r.Role,
            department: r.Department || 'CSE Data Science'
          }))
          .filter(a => a.email);
        if (admins.length > 0) {
          await Admin.insertMany(admins);
          console.log(`Successfully seeded ${admins.length} admins into MongoDB.`);
        }
      }
    }
  } catch (err) {
    console.error("Error seeding rosters into MongoDB:", err.message);
  }
}

// Helper: Search and validate user by Role and Email
async function findUserByRole(email, role) {
  const emailLower = email.trim().toLowerCase();
  
  // Dynamic lookup for Arijit Pal from Excel files
  let arijitAdminEmail = null;
  let arijitTeacherEmail = null;
  
  try {
    const adminRows = readExcelFile('admin data.xlsx');
    const adminRow = adminRows.find(r => r.Name === 'Arijit Pal');
    if (adminRow && adminRow.Email) {
      arijitAdminEmail = adminRow.Email.toString().trim().toLowerCase();
    }
  } catch (e) {}
  
  try {
    const teacherRows = readExcelFile('teacher data.xlsx');
    const teacherRow = teacherRows.find(r => r['Additional Name'] === 'Arijit Pal');
    if (teacherRow && teacherRow['Additional Email']) {
      arijitTeacherEmail = teacherRow['Additional Email'].toString().trim().toLowerCase();
    }
  } catch (e) {}

  // Define allowed emails (with fallbacks in case Excel reads fail)
  const allowedAdminEmails = arijitAdminEmail ? [arijitAdminEmail] : ['arijitp203@gmail.com', 'ap2446961@gmail.com'];
  const allowedTeacherEmails = arijitTeacherEmail ? [arijitTeacherEmail] : ['arijitp203@gmail.com', 'ap2446961@gmail.com'];
  const allowedStudentEmails = arijitAdminEmail ? [arijitAdminEmail] : (arijitTeacherEmail ? [arijitTeacherEmail] : ['arijitp203@gmail.com', 'ap2446961@gmail.com']);

  // Exception bypass for Arijit Pal to log in as all 3 roles
  if (role === 'Admin' && allowedAdminEmails.includes(emailLower)) {
    return {
      name: 'Arijit Pal',
      mobile: '8100610943',
      email: emailLower,
      role: 'Admin',
      department: 'CSE Data Science'
    };
  } else if (role === 'Teacher' && allowedTeacherEmails.includes(emailLower)) {
    return {
      name: 'Arijit Pal',
      mobile: '8100610943',
      email: emailLower,
      role: 'Teacher',
      additionalName: 'Prof. (Dr.) Nilanjan Chatterjee',
      additionalMobile: '9153051003',
      additionalEmail: 'nilanjan.chatterjee@uem.edu.in'
    };
  } else if (role === 'Student' && allowedStudentEmails.includes(emailLower)) {
    return {
      name: 'Arijit Pal',
      mobile: '8100610943',
      email: emailLower,
      role: 'Student',
      department: 'CSE Data Science',
      supervisorName: 'Prof. (Dr.) Nilanjan Chatterjee',
      supervisorMobile: '9153051003',
      supervisorEmail: 'nilanjan.chatterjee@uem.edu.in'
    };
  }

  if (mongoose.connection.readyState === 1) {
    try {
      if (role === 'Admin') {
        const user = await Admin.findOne({ email: emailLower });
        if (user) {
          return {
            name: user.name,
            mobile: user.mobile,
            email: user.email,
            role: user.role,
            department: user.department,
            profilePic: user.profilePic || null
          };
        }
      } else if (role === 'Teacher') {
        const user = await Teacher.findOne({ email: emailLower });
        if (user) {
          return {
            name: user.name,
            mobile: user.mobile,
            email: user.email,
            role: 'Teacher',
            additionalName: user.additionalName || null,
            additionalMobile: user.additionalMobile || null,
            additionalEmail: user.additionalEmail || null,
            profilePic: user.profilePic || null
          };
        }
      } else if (role === 'Student') {
        const user = await Student.findOne({ email: emailLower });
        if (user) {
          return {
            name: user.name,
            mobile: user.mobile,
            email: user.email,
            role: 'Student',
            department: user.department || 'CSE Data Science',
            supervisorName: user.supervisorName || null,
            supervisorMobile: user.supervisorMobile || null,
            supervisorEmail: user.supervisorEmail || null,
            profilePic: user.profilePic || null
          };
        }
      }
    } catch (err) {
      console.error("Error in findUserByRole (DB mode):", err.message);
    }
  }
  
  if (role === 'Admin') {
    try {
      const rows = readExcelFile('admin data.xlsx');
      const userRow = rows.find(r => r.Email && r.Email.toString().trim().toLowerCase() === emailLower);
      if (userRow) {
        const userRole = userRow.Role ? userRow.Role.toString().trim().toUpperCase() : '';
        if (userRole !== 'STUDENT') {
          return {
            name: userRow.Name,
            mobile: userRow.Mobile,
            email: userRow.Email,
            role: userRow.Role,
            department: userRow.Department
          };
        }
      }
    } catch (e) {
      console.error("Error searching in admin data.xlsx:", e.message);
    }
  } else if (role === 'Teacher') {
    try {
      const rows = readExcelFile('teacher data.xlsx');
      const userRow = rows.find(r => r['Supervisor Email'] && r['Supervisor Email'].toString().trim().toLowerCase() === emailLower);
      if (userRow) {
        return {
          name: userRow['Supervisor Name'],
          mobile: userRow['Supervisor Mobile'],
          email: userRow['Supervisor Email'],
          role: 'Teacher',
          additionalName: userRow['Additional Name'] || null,
          additionalMobile: userRow['Additional Mobile'] || null,
          additionalEmail: userRow['Additional Email'] || null
        };
      }
    } catch (e) {
      console.error("Error searching in teacher data.xlsx:", e.message);
    }
  } else if (role === 'Student') {
    try {
      let studentProfile = null;
      const adminRows = readExcelFile('admin data.xlsx');
      const adminRow = adminRows.find(r => r.Email && r.Email.toString().trim().toLowerCase() === emailLower);
      if (adminRow) {
        const userRole = adminRow.Role ? adminRow.Role.toString().trim().toUpperCase() : '';
        if (userRole === 'STUDENT') {
          studentProfile = {
            name: adminRow.Name,
            mobile: adminRow.Mobile,
            email: adminRow.Email,
            role: 'Student',
            department: adminRow.Department
          };
        }
      }
      
      const teacherRows = readExcelFile('teacher data.xlsx');
      const teacherRow = teacherRows.find(r => r['Additional Email'] && r['Additional Email'].toString().trim().toLowerCase() === emailLower);
      if (teacherRow) {
        if (!studentProfile) {
          studentProfile = {
            name: teacherRow['Additional Name'],
            mobile: teacherRow['Additional Mobile'],
            email: teacherRow['Additional Email'],
            role: 'Student',
            department: 'CSE Data Science'
          };
        }
        studentProfile.supervisorName = teacherRow['Supervisor Name'];
        studentProfile.supervisorMobile = teacherRow['Supervisor Mobile'];
        studentProfile.supervisorEmail = teacherRow['Supervisor Email'];
      }
      
      return studentProfile;
    } catch (e) {
      console.error("Error searching student details in excel sheets:", e.message);
    }
  }
  
  return null;
}

// Helper: Search student in student list sheet
async function findStudentByEnrollmentAndRoll(enrollmentNo, rollNo) {
  if (mongoose.connection.readyState === 1) {
    try {
      const students = await Student.find({ roll: rollNo.toString().trim() });
      for (const s of students) {
        const cleanRowEnroll = s.enrollment.replace(/\D/g, '');
        const cleanEnteredEnroll = enrollmentNo.toString().replace(/\D/g, '');
        
        const isEnrollMatch = (s.enrollment === enrollmentNo.toString().trim()) ||
                              (cleanRowEnroll.endsWith(cleanEnteredEnroll)) ||
                              (cleanEnteredEnroll.endsWith(cleanRowEnroll)) ||
                              (cleanRowEnroll.slice(-6) === cleanEnteredEnroll.slice(-6));
        if (isEnrollMatch) {
          return {
            name: s.name,
            roll: s.roll,
            enrollment: s.enrollment,
            email: s.email,
            mobile: s.mobile,
            supervisorName: s.supervisorName,
            supervisorMobile: s.supervisorMobile,
            supervisorEmail: s.supervisorEmail
          };
        }
      }
    } catch (err) {
      console.error("Error in findStudentByEnrollmentAndRoll (DB mode):", err.message);
    }
  }

  try {
    const filePath = path.join(__dirname, 'student_list passout 2028.xlsx');
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    let headerRowIndex = -1;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row && row.includes('Class Roll') && row.includes('Enrollment No.')) {
        headerRowIndex = i;
        break;
      }
    }
    
    if (headerRowIndex === -1) {
      throw new Error("Headers 'Class Roll' and 'Enrollment No.' not found in student list.");
    }
    
    const rollColIndex = data[headerRowIndex].indexOf('Class Roll');
    const nameColIndex = data[headerRowIndex].indexOf('Student Name');
    const enrollColIndex = data[headerRowIndex].indexOf('Enrollment No.');
    
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (row && row[rollColIndex] !== undefined && row[enrollColIndex] !== undefined) {
        const rowRoll = row[rollColIndex].toString().trim();
        const rowEnroll = row[enrollColIndex].toString().trim();
        const cleanRowEnroll = rowEnroll.replace(/\D/g, '');
        const cleanEnteredEnroll = enrollmentNo.toString().replace(/\D/g, '');
        
        const isRollMatch = rowRoll === rollNo.toString().trim();
        const isEnrollMatch = (rowEnroll === enrollmentNo.toString().trim()) ||
                              (cleanRowEnroll.endsWith(cleanEnteredEnroll)) ||
                              (cleanEnteredEnroll.endsWith(cleanRowEnroll)) ||
                              (cleanRowEnroll.slice(-6) === cleanEnteredEnroll.slice(-6));
        
        if (isRollMatch && isEnrollMatch) {
          return {
            name: row[nameColIndex] ? row[nameColIndex].toString().trim() : '',
            roll: rowRoll,
            enrollment: rowEnroll
          };
        }
      }
    }
  } catch (error) {
    console.error("Error reading student list Excel:", error.message);
  }
  return null;
}

// Helper: Find student email by name in database sheets
async function findStudentEmailByName(name) {
  const nameLower = name.toLowerCase().trim();

  if (mongoose.connection.readyState === 1) {
    try {
      const student = await Student.findOne({ name: new RegExp('^' + nameLower + '$', 'i') });
      if (student && student.email && student.email !== 'N/A') {
        return student.email;
      }
    } catch (err) {
      console.error("Error in findStudentEmailByName (DB mode):", err.message);
    }
  }
  
  try {
    const adminRows = readExcelFile('admin data.xlsx');
    const match = adminRows.find(r => r.Name && r.Name.toString().toLowerCase().trim() === nameLower && r.Role && r.Role.toString().toLowerCase().trim() === 'student');
    if (match && match.Email) {
      return match.Email.toString().trim();
    }
  } catch (e) {
    console.error("Error searching student email in admin data:", e.message);
  }
  
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
    const studentInfo = await findStudentByEnrollmentAndRoll(enrollmentNo, rollNo);
    if (!studentInfo) {
      console.log(`Failed Student login attempt: Enrollment ${enrollmentNo}, Roll ${rollNo} not found in student list`);
      return res.status(400).json({ 
        success: false, 
        message: 'Either you selected wrong role, or wrong enrollment/roll number' 
      });
    }
    
    // Lookup student email address in our directory
    userEmail = await findStudentEmailByName(studentInfo.name);
    
    // Safety check / bypass for Arijit Pal
    if (studentInfo.name.toLowerCase().includes('arijit pal')) {
      userEmail = await findStudentEmailByName(studentInfo.name) || 'ap2446961@gmail.com';
    }
    
    if (!userEmail) {
      console.log(`Failed Student login: No email registered for student name ${studentInfo.name}`);
      return res.status(400).json({ 
        success: false, 
        message: 'Email address not found for this student. Please contact administrator.' 
      });
    }
    
    // Fetch full student profile (including supervisor details)
    userProfile = await findUserByRole(userEmail, 'Student');
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
    
    userProfile = await findUserByRole(email, role);
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
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

  // Cache the OTP along with profile details
  otpCache.set(userEmail.toLowerCase(), { 
    otp, 
    role,
    profile: userProfile,
    expiresAt 
  });

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
    await sendVerificationEmail(
      userEmail,
      `🔐 ${otp} is your Attendance - CSE(Data Science) ${role} verification code`,
      htmlContent,
      `Hello ${greetingName}, your verification code for signing in as ${role} is: ${otp}. It will expire in 5 minutes.`
    );
    console.log(`OTP (${otp}) successfully sent to ${userEmail} for role ${role}`);
    res.status(200).json({ success: true, message: 'Verification code sent to your email.', email: userEmail });
  } catch (error) {
    console.error(`Error sending email to ${userEmail}:`, error);
    res.status(500).json({ success: false, message: 'Failed to send verification email. Please try again later.' });
  }
});

// Endpoint: Verify OTP & Return User Details
app.post('/api/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and verification code are required.' });
  }

  const cachedData = otpCache.get(email.toLowerCase());

  if (!cachedData) {
    return res.status(400).json({ success: false, message: 'Verification code not found. Please request a new one.' });
  }

  if (Date.now() > cachedData.expiresAt) {
    otpCache.delete(email.toLowerCase());
    return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new one.' });
  }

  if (cachedData.otp !== otp.trim()) {
    return res.status(400).json({ success: false, message: 'Invalid verification code. Please check and try again.' });
  }

  const userProfile = cachedData.profile;
  const userRole = cachedData.role;

  // Clear OTP on successful validation
  otpCache.delete(email.toLowerCase());

  res.status(200).json({
    success: true,
    message: 'Authentication successful.',
    user: {
    email: email.toLowerCase(),
      role: userRole,
      profile: userProfile
    }
  });
});

// Endpoint: Direct Student Login (Enrollment and Roll Number)
app.post('/api/student-login', async (req, res) => {
  const { enrollmentNo, rollNo } = req.body;

  if (!enrollmentNo || !rollNo) {
    return res.status(400).json({ success: false, message: 'Enrollment number and Class Roll number are required.' });
  }

  if (mongoose.connection.readyState === 1) {
    try {
      const studentInfo = await findStudentByEnrollmentAndRoll(enrollmentNo, rollNo);
      if (!studentInfo) {
        console.log(`Failed Student login: Enrollment ${enrollmentNo}, Roll ${rollNo} not found.`);
        return res.status(400).json({ 
          success: false, 
          message: 'Either you selected wrong role, or wrong enrollment/roll number' 
        });
      }
      
      const profile = {
        name: studentInfo.name,
        email: studentInfo.email || 'N/A',
        mobile: studentInfo.mobile || 'N/A',
        role: 'Student',
        department: 'CSE Data Science',
        roll: studentInfo.roll,
        enrollment: studentInfo.enrollment
      };

      if (studentInfo.supervisorName) {
        profile.supervisorName = studentInfo.supervisorName;
        profile.supervisorMobile = studentInfo.supervisorMobile;
        profile.supervisorEmail = studentInfo.supervisorEmail;
      }

      console.log(`Student ${studentInfo.name} logged in directly.`);

      return res.status(200).json({
        success: true,
        message: 'Authentication successful.',
        user: {
          email: profile.email,
          role: 'Student',
          profile: profile
        }
      });
    } catch (err) {
      console.error("Database query failed in student-login:", err.message);
    }
  }

  const studentInfo = await findStudentByEnrollmentAndRoll(enrollmentNo, rollNo);
  if (!studentInfo) {
    console.log(`Failed Student login: Enrollment ${enrollmentNo}, Roll ${rollNo} not found.`);
    return res.status(400).json({ 
      success: false, 
      message: 'Either you selected wrong role, or wrong enrollment/roll number' 
    });
  }

  // Find if they have extra details in admin/teacher sheets
  let email = (await findStudentEmailByName(studentInfo.name)) || 'N/A';
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
    enrollment: studentInfo.enrollment
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
app.get('/api/student-list', async (req, res) => {
  if (mongoose.connection.readyState === 1) {
    try {
      const students = await Student.find({}, 'name roll enrollment');
      return res.json({ success: true, students });
    } catch (err) {
      console.error("Database query failed in student-list:", err.message);
    }
  }
  const students = getAllStudents();
  res.json({ success: true, students });
});

// Endpoint: Get full teacher list
app.get('/api/teacher-list', async (req, res) => {
  if (mongoose.connection.readyState === 1) {
    try {
      const teachers = await Teacher.find({}, 'name email mobile');
      return res.json({ success: true, teachers });
    } catch (err) {
      console.error("Database query failed in teacher-list:", err.message);
    }
  }
  const teachers = getAllTeachers();
  res.json({ success: true, teachers });
});

// Endpoint: Mark Attendance
app.post('/api/attendance/mark', async (req, res) => {
  const { date, subject, year, section, teacherEmail, teacherName, students, sessionToken, source } = req.body;

  if (!date || !subject || !year || !section || !teacherEmail || !teacherName || !students || !Array.isArray(students)) {
    return res.status(400).json({ success: false, message: 'Missing required fields: date, subject, year, section, teacherEmail, teacherName, students.' });
  }

  if (students.length === 0) {
    return res.status(400).json({ success: false, message: 'Student list cannot be empty.' });
  }

  const recordId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

  const record = {
    id: recordId,
    date,
    subject: subject.trim(),
    year: year.trim(),
    section: section.trim(),
    teacherEmail: teacherEmail.trim().toLowerCase(),
    teacherName: teacherName.trim(),
    students: students.map(s => ({
      name: s.name,
      roll: s.roll,
      enrollment: s.enrollment,
      present: !!s.present
    })),
    createdAt: new Date().toISOString(),
    sessionToken: sessionToken || null,
    source: source || 'manual'
  };

  if (mongoose.connection.readyState === 1) {
    try {
      await Attendance.create(record);
    } catch (err) {
      console.error("Error saving attendance to MongoDB:", err.message);
      return res.status(500).json({ success: false, message: 'Failed to record attendance to database.' });
    }
  }

  try {
    const data = readAttendanceData();
    data.push(record);
    writeAttendanceData(data);
  } catch (fileErr) {
    console.warn("Local JSON attendance sync skipped/failed:", fileErr.message);
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ success: false, message: 'Failed to write attendance to local file.' });
    }
  }

  console.log(`Attendance marked by ${teacherName} for ${subject} (${year} - ${section}) on ${date} — ${students.filter(s => s.present).length}/${students.length} present`);
  res.json({ success: true, message: 'Attendance recorded successfully.', record });
});

// Endpoint: Get student's attendance records by enrollment number
app.get('/api/attendance/student/:enrollment', async (req, res) => {
  const enrollment = decodeURIComponent(req.params.enrollment).trim();

  if (mongoose.connection.readyState === 1) {
    try {
      const records = await Attendance.find({ "students.enrollment": enrollment });
      const studentRecords = records.map(record => {
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
      return res.json({ success: true, records: studentRecords });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Database query failed.' });
    }
  }

  const allRecords = readAttendanceData();
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

  if (mongoose.connection.readyState === 1) {
    try {
      const records = await Attendance.find({ teacherEmail: email });
      return res.json({ success: true, records });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Database query failed.' });
    }
  }

  const allRecords = readAttendanceData();
  const teacherRecords = allRecords.filter(record =>
    record.teacherEmail === email
  );

  res.json({ success: true, records: teacherRecords });
});

// Endpoint: Get all attendance records (for admin)
app.get('/api/attendance/all', async (req, res) => {
  if (mongoose.connection.readyState === 1) {
    try {
      const records = await Attendance.find({});
      return res.json({ success: true, records });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Database query failed.' });
    }
  }

  const allRecords = readAttendanceData();
  res.json({ success: true, records: allRecords });
});

// Endpoint: Get attendance statistics (for admin)
app.get('/api/attendance/stats', async (req, res) => {
  if (mongoose.connection.readyState === 1) {
    try {
      const allRecords = await Attendance.find({});
      const students = await Student.find({});
      const teachers = await Teacher.find({});

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

      return res.json({
        success: true,
        stats: {
          totalStudents: students.length,
          totalTeachers: teachers.length,
          totalClasses,
          overallAttendance
        }
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Database query failed.' });
    }
  }

  const allRecords = readAttendanceData();
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

  if (mongoose.connection.readyState === 1) {
    try {
      const result = await Attendance.deleteOne({ id });
      if (result.deletedCount === 0) {
        return res.status(404).json({ success: false, message: 'Record not found.' });
      }
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Database deletion failed.' });
    }
  }

  try {
    let data = readAttendanceData();
    const initialLength = data.length;
    data = data.filter(record => record.id !== id);

    if (data.length === initialLength && mongoose.connection.readyState !== 1) {
      return res.status(404).json({ success: false, message: 'Record not found.' });
    }
    
    writeAttendanceData(data);
  } catch (fileErr) {
    console.warn("Local attendance JSON deletion sync skipped/failed:", fileErr.message);
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

  let updatedRecord = null;

  if (mongoose.connection.readyState === 1) {
    try {
      const record = await Attendance.findOne({ id: recordId });
      if (!record) {
        return res.status(404).json({ success: false, message: 'Attendance record not found.' });
      }

      const student = record.students.find(s => s.enrollment === enrollment);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student not found in this record.' });
      }

      student.present = !!present;
      await record.save();
      updatedRecord = record;
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Database update failed.' });
    }
  }

  try {
    const data = readAttendanceData();
    const record = data.find(r => r.id === recordId);

    if (record) {
      const student = record.students.find(s => s.enrollment === enrollment);
      if (student) {
        student.present = !!present;
        writeAttendanceData(data);
        if (!updatedRecord) {
          updatedRecord = record;
        }
      } else if (mongoose.connection.readyState !== 1) {
        return res.status(404).json({ success: false, message: 'Student not found in this record.' });
      }
    } else if (mongoose.connection.readyState !== 1) {
      return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    }
  } catch (fileErr) {
    console.warn("Local attendance JSON patch sync skipped/failed:", fileErr.message);
  }

  console.log(`Admin updated attendance in record ${recordId}: Student enrollment ${enrollment} set to ${present ? 'Present' : 'Absent'}`);
  res.json({ success: true, message: 'Student status updated successfully.', record: updatedRecord });
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

  const recordId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

  const record = {
    id: recordId,
    senderRole: role,
    senderName: name.trim(),
    senderEmail: senderEmail ? senderEmail.trim().toLowerCase() : null,
    studentRoll: studentRoll ? studentRoll.trim() : null,
    studentEnrollment: studentEnrollment ? studentEnrollment.trim() : null,
    studentName: name.trim(),
    message: message.trim(),
    createdAt: new Date().toISOString()
  };

  if (mongoose.connection.readyState === 1) {
    try {
      await Grievance.create(record);
    } catch (err) {
      console.error("Error saving grievance to MongoDB:", err.message);
      return res.status(500).json({ success: false, message: 'Failed to submit grievance to database.' });
    }
  }

  try {
    const data = readGrievanceData();
    data.push(record);
    writeGrievanceData(data);
  } catch (fileErr) {
    console.warn("Local grievance JSON sync skipped/failed:", fileErr.message);
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ success: false, message: 'Failed to write grievance to local file.' });
    }
  }

  console.log(`Grievance submitted by ${role} ${name} (${senderEmail || studentEnrollment})`);
  res.json({ success: true, message: 'Grievance submitted successfully.', grievance: record });
});

// Endpoint: Get all student grievances (for admin only)
app.get('/api/grievances', async (req, res) => {
  if (mongoose.connection.readyState === 1) {
    try {
      const grievances = await Grievance.find({});
      return res.json({ success: true, grievances });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Database query failed.' });
    }
  }

  const data = readGrievanceData();
  res.json({ success: true, grievances: data });
});

// Endpoint: Delete a student grievance (for admin only)
app.delete('/api/grievance/:id', async (req, res) => {
  const id = req.params.id;

  if (mongoose.connection.readyState === 1) {
    try {
      const result = await Grievance.deleteOne({ id });
      if (result.deletedCount === 0) {
        return res.status(404).json({ success: false, message: 'Grievance not found.' });
      }
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Database deletion failed.' });
    }
  }

  try {
    let data = readGrievanceData();
    const initialLength = data.length;
    data = data.filter(g => g.id !== id);

    if (data.length === initialLength && mongoose.connection.readyState !== 1) {
      return res.status(404).json({ success: false, message: 'Grievance not found.' });
    }
    writeGrievanceData(data);
  } catch (fileErr) {
    console.warn("Local grievance JSON deletion sync skipped/failed:", fileErr.message);
  }

  res.json({ success: true, message: 'Grievance deleted successfully.' });
});


// ============================================================
// EMAIL CHANGE SYSTEM ENDPOINTS & HELPERS
// ============================================================

// Helper: Update user email in Excel sheets
function updateEmailInExcels(currentEmail, newEmail, role) {
  const currentLower = currentEmail.toLowerCase().trim();
  const newTrimmed = newEmail.trim();

  // 1. Update in admin data.xlsx
  try {
    const adminPath = path.join(__dirname, 'admin data.xlsx');
    if (fs.existsSync(adminPath)) {
      const workbook = xlsx.readFile(adminPath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet);
      
      let updated = false;
      data.forEach(row => {
        if (row.Email && row.Email.toString().toLowerCase().trim() === currentLower) {
          row.Email = newTrimmed;
          updated = true;
        }
      });
      
      if (updated) {
        workbook.Sheets[sheetName] = xlsx.utils.json_to_sheet(data);
        xlsx.writeFile(workbook, adminPath);
        console.log(`Updated email from ${currentEmail} to ${newEmail} in admin data.xlsx`);
      }
    }
  } catch (e) {
    console.error("Error updating email in admin data.xlsx:", e.message);
  }

  // 2. Update in teacher data.xlsx
  try {
    const teacherPath = path.join(__dirname, 'teacher data.xlsx');
    if (fs.existsSync(teacherPath)) {
      const workbook = xlsx.readFile(teacherPath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet);
      
      let updated = false;
      data.forEach(row => {
        if (row['Supervisor Email'] && row['Supervisor Email'].toString().toLowerCase().trim() === currentLower) {
          row['Supervisor Email'] = newTrimmed;
          updated = true;
        }
        if (row['Additional Email'] && row['Additional Email'].toString().toLowerCase().trim() === currentLower) {
          row['Additional Email'] = newTrimmed;
          updated = true;
        }
      });
      
      if (updated) {
        workbook.Sheets[sheetName] = xlsx.utils.json_to_sheet(data);
        xlsx.writeFile(workbook, teacherPath);
        console.log(`Updated email from ${currentEmail} to ${newEmail} in teacher data.xlsx`);
      }
    }
  } catch (e) {
    console.error("Error updating email in teacher data.xlsx:", e.message);
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
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

  // Cache the email change request
  const cacheKey = `emailchange:${newEmail.toLowerCase().trim()}`;
  otpCache.set(cacheKey, {
    otp,
    currentEmail: currentEmail.toLowerCase().trim(),
    newEmail: newEmail.toLowerCase().trim(),
    role,
    expiresAt
  });

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
    await sendVerificationEmail(
      newEmail.trim(),
      `🔐 ${otp} is your Email Change verification code`,
      htmlContent,
      `Your verification code to change your account email address to this one is: ${otp}. It will expire in 5 minutes.`
    );
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

  const cacheKey = `emailchange:${newEmail.toLowerCase().trim()}`;
  const cachedData = otpCache.get(cacheKey);

  if (!cachedData) {
    return res.status(400).json({ success: false, message: 'Verification code not found. Please request a new one.' });
  }

  if (Date.now() > cachedData.expiresAt) {
    otpCache.delete(cacheKey);
    return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new one.' });
  }

  if (cachedData.otp !== otp.trim()) {
    return res.status(400).json({ success: false, message: 'Invalid verification code. Please check and try again.' });
  }

  const { currentEmail, role } = cachedData;
  const oldProfile = await findUserByRole(currentEmail, role);

  // Clear OTP on success
  otpCache.delete(cacheKey);

  // Update MongoDB
  if (mongoose.connection.readyState === 1) {
    try {
      const currentLower = currentEmail.toLowerCase().trim();
      const newLower = newEmail.toLowerCase().trim();
      if (role === 'Admin') {
        await Admin.updateOne({ email: currentLower }, { $set: { email: newLower } });
      } else if (role === 'Teacher') {
        await Teacher.updateOne({ email: currentLower }, { $set: { email: newLower } });
        await Student.updateMany({ supervisorEmail: currentLower }, { $set: { supervisorEmail: newLower } });
      } else if (role === 'Student') {
        await Student.updateOne({ email: currentLower }, { $set: { email: newLower } });
        await Teacher.updateMany({ additionalEmail: currentLower }, { $set: { additionalEmail: newLower } });
      }
      console.log(`Updated email from ${currentEmail} to ${newEmail} in MongoDB (${role})`);
    } catch (dbErr) {
      console.error("Database email update failed:", dbErr.message);
    }
  }

  // Update Excel sheets
  try {
    updateEmailInExcels(currentEmail, newEmail, role);
    handleEmailChangeProfilePic(currentEmail, newEmail);
  } catch (fileErr) {
    console.warn("Excel file/picture email update sync skipped/failed:", fileErr.message);
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ success: false, message: 'Failed to update email in Excel.' });
    }
  }

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
});

// ============================================================
// PROFILE PICTURE SYSTEM ENDPOINTS & HELPERS
// ============================================================

const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads', 'profile_pics');

// Helper: Ensure uploads directory exists
function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

// Helper: Rename profile picture when email changes
function handleEmailChangeProfilePic(oldEmail, newEmail) {
  try {
    ensureUploadsDir();
    const files = fs.readdirSync(UPLOADS_DIR);
    const oldPrefix = oldEmail.toLowerCase().trim();
    const newPrefix = newEmail.toLowerCase().trim();
    
    files.forEach(file => {
      const ext = path.extname(file);
      const base = path.basename(file, ext).toLowerCase().trim();
      if (base === oldPrefix) {
        const oldPath = path.join(UPLOADS_DIR, file);
        const newPath = path.join(UPLOADS_DIR, `${newPrefix}${ext}`);
        if (fs.existsSync(newPath)) {
          fs.unlinkSync(newPath);
        }
        fs.renameSync(oldPath, newPath);
        console.log(`Renamed profile picture from ${oldPath} to ${newPath}`);
      }
    });
  } catch (e) {
    console.error("Error renaming profile picture on email change:", e.message);
  }
}

// Endpoint: Serves the profile picture for a given identifier (email or enrollment)
app.get('/api/profile/pic/:identifier', async (req, res) => {
  const identifier = decodeURIComponent(req.params.identifier).trim().toLowerCase();
  
  if (!identifier) {
    return res.status(400).send('Identifier is required.');
  }

  if (mongoose.connection.readyState === 1) {
    try {
      let user = await Student.findOne({ $or: [{ email: identifier }, { enrollment: identifier }] });
      if (!user) {
        user = await Teacher.findOne({ email: identifier });
      }
      if (!user) {
        user = await Admin.findOne({ email: identifier });
      }

      if (user && user.profilePic) {
        const image = user.profilePic;
        const semiColonIndex = image.indexOf(';base64,');
        if (semiColonIndex !== -1) {
          const mimeType = image.slice(5, semiColonIndex);
          const base64Data = image.slice(semiColonIndex + 8);
          const buffer = Buffer.from(base64Data, 'base64');
          res.set('Content-Type', mimeType);
          return res.send(buffer);
        }
      }
    } catch (dbErr) {
      console.error("Database query for profile picture failed:", dbErr.message);
    }
  }

  ensureUploadsDir();

  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    const filenameMatch = files.find(file => {
      const ext = path.extname(file);
      const base = path.basename(file, ext).toLowerCase().trim();
      return base === identifier;
    });

    if (filenameMatch) {
      const fullPath = path.join(UPLOADS_DIR, filenameMatch);
      return res.sendFile(fullPath);
    }
  } catch (err) {
    console.error("Error reading profile pictures folder:", err.message);
  }

  res.status(404).send('Profile picture not found.');
});

// Endpoint: Upload base64 profile picture
app.post('/api/profile/upload-pic', async (req, res) => {
  const { identifier, image } = req.body;

  if (!identifier || !image) {
    return res.status(400).json({ success: false, message: 'Identifier and image are required.' });
  }

  const cleanIdentifier = identifier.trim().toLowerCase();

  if (!image.startsWith('data:')) {
    return res.status(400).json({ success: false, message: 'Invalid image data format. Must be a base64 Data URL.' });
  }

  const semiColonIndex = image.indexOf(';base64,');
  if (semiColonIndex === -1) {
    return res.status(400).json({ success: false, message: 'Invalid image data format. Must be a base64 Data URL.' });
  }

  const mimeType = image.slice(5, semiColonIndex);
  const base64Data = image.slice(semiColonIndex + 8);
  const buffer = Buffer.from(base64Data, 'base64');

  let ext = '.png';
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') ext = '.jpg';
  else if (mimeType === 'image/gif') ext = '.gif';
  else if (mimeType === 'image/webp') ext = '.webp';
  else if (mimeType !== 'image/png') {
    return res.status(400).json({ success: false, message: 'Unsupported image type. Please upload PNG, JPG, JPEG, GIF, or WEBP.' });
  }

  if (mongoose.connection.readyState === 1) {
    try {
      let updated = false;
      
      let result = await Student.updateOne(
        { $or: [{ email: cleanIdentifier }, { enrollment: cleanIdentifier }] },
        { $set: { profilePic: image } }
      );
      if (result.matchedCount > 0) updated = true;

      if (!updated) {
        result = await Teacher.updateOne(
          { email: cleanIdentifier },
          { $set: { profilePic: image } }
        );
        if (result.matchedCount > 0) updated = true;
      }

      if (!updated) {
        result = await Admin.updateOne(
          { email: cleanIdentifier },
          { $set: { profilePic: image } }
        );
        if (result.matchedCount > 0) updated = true;
      }

      if (!updated) {
        console.warn(`User with identifier ${cleanIdentifier} not found in database to attach profile picture.`);
      }
    } catch (dbErr) {
      console.error("Database save for profile picture failed:", dbErr.message);
    }
  }

  try {
    ensureUploadsDir();
    const files = fs.readdirSync(UPLOADS_DIR);
    files.forEach(file => {
      const fileExt = path.extname(file);
      const base = path.basename(file, fileExt).toLowerCase().trim();
      if (base === cleanIdentifier) {
        fs.unlinkSync(path.join(UPLOADS_DIR, file));
      }
    });

    const targetPath = path.join(UPLOADS_DIR, `${cleanIdentifier}${ext}`);
    fs.writeFileSync(targetPath, buffer);
    console.log(`Saved profile picture for ${cleanIdentifier} to ${targetPath}`);
  } catch (fileErr) {
    console.warn("Local profile pic file save skipped/failed:", fileErr.message);
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ success: false, message: 'Server failed to save the profile picture.' });
    }
  }

  res.json({ success: true, message: 'Profile picture uploaded successfully.' });
});

// ============================================================
// LIVE ATTENDANCE SESSION API ENDPOINTS
// ============================================================

// Endpoint: Teacher creates a live session
app.post('/api/session/create', async (req, res) => {
  const { teacherEmail, teacherName, subject, year, section, date } = req.body;
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
    section: section.trim(),
    date,
    status: 'active',           // 'active' | 'closed'
    markedStudents: [],          // [{ name, roll, enrollment, markedAt }]
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()  // 4-hour expiry
  };

  if (mongoose.connection.readyState === 1) {
    try {
      await LiveSession.create(session);
    } catch (err) {
      console.error("Error creating session in MongoDB:", err.message);
      return res.status(500).json({ success: false, message: 'Failed to create live session in database.' });
    }
  }

  try {
    const sessions = readSessionsData();
    sessions.push(session);
    writeSessionsData(sessions);
  } catch (fileErr) {
    console.warn("Local session JSON sync skipped/failed:", fileErr.message);
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ success: false, message: 'Failed to write session to local file.' });
    }
  }

  console.log(`Live session created by ${teacherName} for ${subject} (${year} - ${section}) on ${date} | Token: ${token}`);
  res.json({ success: true, token, message: 'Session created.' });
});

// Endpoint: Get session info by token (used by student to preview)
app.get('/api/session/:token', async (req, res) => {
  const { token } = req.params;
  const { enrollment } = req.query;

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (mongoose.connection.readyState === 1) {
    try {
      const session = await LiveSession.findOne({ token });
      if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found. The link may be invalid.' });
      }

      // Check expiry
      if (new Date() > new Date(session.expiresAt) && session.status === 'active') {
        session.status = 'expired';
        await session.save();
      }

      let alreadyMarked = false;
      if (enrollment && session.markedStudents) {
        alreadyMarked = session.markedStudents.some(s => s.enrollment.trim() === enrollment.trim());
      }

      return res.json({
        success: true,
        session: {
          token: session.token,
          teacherName: session.teacherName,
          subject: session.subject,
          year: session.year,
          section: session.section,
          date: session.date,
          status: session.status,
          markedCount: session.markedStudents.length,
          alreadyMarked: alreadyMarked
        }
      });
    } catch (err) {
      console.error("Database query failed in GET /api/session/:token:", err.message);
      return res.status(500).json({ success: false, message: 'Database query failed.' });
    }
  }

  const sessions = readSessionsData();
  const session = sessions.find(s => s.token === token);

  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found. The link may be invalid.' });
  }

  // Check expiry
  if (new Date() > new Date(session.expiresAt) && session.status === 'active') {
    session.status = 'expired';
    writeSessionsData(sessions);
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

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (mongoose.connection.readyState === 1) {
    try {
      const session = await LiveSession.findOne({ token });
      if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found.' });
      }
      return res.json({
        success: true,
        status: session.status,
        markedCount: session.markedStudents.length,
        markedStudents: session.markedStudents.map(s => ({ name: s.name, roll: s.roll }))
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Database query failed.' });
    }
  }

  const sessions = readSessionsData();
  const session = sessions.find(s => s.token === token);

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
  const { name, roll, enrollment } = req.body;

  if (!name || !roll || !enrollment) {
    return res.status(400).json({ success: false, message: 'Student name, roll, and enrollment are required.' });
  }

  if (mongoose.connection.readyState === 1) {
    try {
      const session = await LiveSession.findOne({ token });
      if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found. The link may be invalid.' });
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
        session.status = 'expired';
        await session.save();
        return res.status(403).json({ success: false, closed: true, message: 'This session has expired.' });
      }

      // Prevent duplicate marking by same student
      const alreadyMarked = session.markedStudents.some(s => s.enrollment === enrollment.trim());
      if (alreadyMarked) {
        return res.json({ success: true, alreadyMarked: true, message: 'You have already marked your attendance for this session.' });
      }

      session.markedStudents.push({
        name: name.trim(),
        roll: roll.toString().trim(),
        enrollment: enrollment.trim(),
        markedAt: new Date()
      });

      await session.save();
      console.log(`Student ${name} (${enrollment}) marked present in session ${token} (DB mode)`);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Database save failed.' });
    }
  }

  try {
    const sessions = readSessionsData();
    const sessionIndex = sessions.findIndex(s => s.token === token);

    if (sessionIndex !== -1) {
      const session = sessions[sessionIndex];
      if (session.status !== 'active' && mongoose.connection.readyState !== 1) {
        return res.status(403).json({
          success: false,
          closed: true,
          message: session.status === 'closed'
            ? 'Attendance is already recorded. This session is closed.'
            : 'This session has expired.'
        });
      }

      if (new Date() > new Date(session.expiresAt)) {
        session.status = 'expired';
        sessions[sessionIndex] = session;
        writeSessionsData(sessions);
        if (mongoose.connection.readyState !== 1) {
          return res.status(403).json({ success: false, closed: true, message: 'This session has expired.' });
        }
      }

      const alreadyMarked = session.markedStudents.some(s => s.enrollment === enrollment.trim());
      if (alreadyMarked) {
        if (mongoose.connection.readyState !== 1) {
          return res.json({ success: true, alreadyMarked: true, message: 'You have already marked your attendance for this session.' });
        }
      } else {
        session.markedStudents.push({
          name: name.trim(),
          roll: roll.toString().trim(),
          enrollment: enrollment.trim(),
          markedAt: new Date().toISOString()
        });

        sessions[sessionIndex] = session;
        writeSessionsData(sessions);
        console.log(`Student ${name} (${enrollment}) marked present in session ${token} (File mode)`);
      }
    } else if (mongoose.connection.readyState !== 1) {
      return res.status(404).json({ success: false, message: 'Session not found. The link may be invalid.' });
    }
  } catch (fileErr) {
    console.warn("Local session JSON marking sync skipped/failed:", fileErr.message);
  }

  res.json({ success: true, message: `Your attendance has been marked! ✅` });
});

// Endpoint: Teacher closes session and records attendance into the main attendance system
app.post('/api/session/:token/close', async (req, res) => {
  const { token } = req.params;

  let session = null;
  if (mongoose.connection.readyState === 1) {
    try {
      session = await LiveSession.findOne({ token });
    } catch (err) {
      console.error(err);
    }
  }

  // Fallback to local files if not in DB mode
  let localSessionIndex = -1;
  const sessions = readSessionsData();
  if (!session) {
    localSessionIndex = sessions.findIndex(s => s.token === token);
    if (localSessionIndex !== -1) {
      session = sessions[localSessionIndex];
    }
  }

  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found.' });
  }

  if (session.status === 'closed') {
    return res.json({ success: true, alreadyClosed: true, message: 'Session already closed and attendance recorded.' });
  }

  // Close the session
  session.status = 'closed';
  session.closedAt = new Date().toISOString();

  if (mongoose.connection.readyState === 1) {
    try {
      await LiveSession.updateOne({ token }, { $set: { status: 'closed', closedAt: new Date() } });
    } catch (dbErr) {
      console.error("Failed to close session in database:", dbErr.message);
    }
  }

  try {
    const localIndex = sessions.findIndex(s => s.token === token);
    if (localIndex !== -1) {
      sessions[localIndex].status = 'closed';
      sessions[localIndex].closedAt = new Date().toISOString();
      writeSessionsData(sessions);
    }
  } catch (fileErr) {
    console.warn("Local session close sync skipped/failed:", fileErr.message);
  }

  // Get full student list to include all students
  let allStudents = [];
  if (mongoose.connection.readyState === 1) {
    try {
      allStudents = await Student.find({}, 'name roll enrollment');
    } catch (err) {
      console.error(err);
    }
  }
  if (allStudents.length === 0) {
    allStudents = getAllStudents();
  }

  const markedEnrollments = new Set(session.markedStudents.map(s => s.enrollment));

  let studentsForRecord;
  if (allStudents.length > 0) {
    studentsForRecord = allStudents.map(s => ({
      name: s.name,
      roll: s.roll,
      enrollment: s.enrollment,
      present: markedEnrollments.has(s.enrollment)
    }));
  } else {
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

  const recordId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  const record = {
    id: recordId,
    date: session.date,
    subject: session.subject,
    year: session.year,
    section: session.section,
    teacherEmail: session.teacherEmail,
    teacherName: session.teacherName,
    students: studentsForRecord,
    source: 'live-session',
    sessionToken: token,
    createdAt: new Date().toISOString()
  };

  if (mongoose.connection.readyState === 1) {
    try {
      await Attendance.create(record);
    } catch (dbErr) {
      console.error("Failed to record live session attendance to MongoDB:", dbErr.message);
    }
  }

  try {
    const attendanceData = readAttendanceData();
    attendanceData.push(record);
    writeAttendanceData(attendanceData);
  } catch (fileErr) {
    console.warn("Local attendance JSON live session sync skipped/failed:", fileErr.message);
  }

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

function addStudent(name, roll, enrollment) {
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
  
  const enrollClean = enrollment.toString().trim().toLowerCase();
  const rollClean = roll.toString().trim();
  
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const r = rows[i];
    if (r) {
      if (r[enrollCol] && r[enrollCol].toString().trim().toLowerCase() === enrollClean) {
        throw new Error('A student with this enrollment number already exists.');
      }
      if (r[rollCol] && r[rollCol].toString().trim() === rollClean) {
        throw new Error('A student with this Class Roll number already exists.');
      }
    }
  }
  
  const newRow = [];
  newRow[rollCol] = parseInt(roll) || roll;
  newRow[nameCol] = name.trim().toUpperCase();
  newRow[enrollCol] = enrollment.toString().trim();
  
  rows.push(newRow);
  
  workbook.Sheets[sheetName] = xlsx.utils.aoa_to_sheet(rows);
  xlsx.writeFile(workbook, filePath);
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

app.get('/api/admin/users', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const admins = await Admin.find({});
      const teachers = await Teacher.find({});
      const students = await Student.find({});
      return res.json({
        success: true,
        admins: admins.map(a => ({
          name: a.name,
          mobile: a.mobile,
          email: a.email,
          role: a.role,
          department: a.department
        })),
        teachers: teachers.map(t => ({
          name: t.name,
          email: t.email,
          mobile: t.mobile
        })),
        students: students.map(s => ({
          name: s.name,
          roll: s.roll,
          enrollment: s.enrollment
        }))
      });
    }

    let admins = [];
    if (fs.existsSync(path.join(__dirname, 'admin data.xlsx'))) {
      const rows = readExcelFile('admin data.xlsx');
      admins = rows
        .filter(r => r.Role && r.Role.toString().trim().toUpperCase() !== 'STUDENT')
        .map(r => ({
          name: r.Name || 'N/A',
          mobile: r.Mobile || 'N/A',
          email: r.Email || 'N/A',
          role: r.Role || 'N/A',
          department: r.Department || 'CSE Data Science'
        }));
    }

    const teachers = getAllTeachers();
    const students = getAllStudents();

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
    if (mongoose.connection.readyState === 1) {
      if (role === 'Admin') {
        const { name, mobile, email, adminRole, department } = data;
        if (!name || !email || !adminRole) {
          return res.status(400).json({ success: false, message: 'Name, email, and specific role are required.' });
        }
        
        const exists = await Admin.findOne({ email: email.toLowerCase() }) || await Student.findOne({ email: email.toLowerCase() });
        if (exists) {
          return res.status(400).json({ success: false, message: 'An admin or student with this email already exists.' });
        }
        
        await Admin.create({
          name: name.trim(),
          mobile: mobile ? mobile.trim() : 'N/A',
          email: email.trim().toLowerCase(),
          role: adminRole.trim(),
          department: department ? department.trim() : 'CSE Data Science'
        });
        console.log(`Admin ${name} (${email}) added to DB.`);
      } else if (role === 'Teacher') {
        const { name, mobile, email } = data;
        if (!name || !email) {
          return res.status(400).json({ success: false, message: 'Name and email are required.' });
        }
        
        const exists = await Teacher.findOne({ email: email.toLowerCase() });
        if (exists) {
          return res.status(400).json({ success: false, message: 'A teacher with this email already exists.' });
        }
        
        await Teacher.create({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          mobile: mobile ? mobile.trim() : 'N/A'
        });
        console.log(`Teacher ${name} (${email}) added to DB.`);
      } else if (role === 'Student') {
        const { name, roll, enrollment } = data;
        if (!name || !roll || !enrollment) {
          return res.status(400).json({ success: false, message: 'Name, Class Roll, and Enrollment Number are required.' });
        }
        
        const existsEnroll = await Student.findOne({ enrollment: enrollment.trim() });
        if (existsEnroll) {
          return res.status(400).json({ success: false, message: 'A student with this enrollment number already exists.' });
        }
        const existsRoll = await Student.findOne({ roll: roll.trim() });
        if (existsRoll) {
          return res.status(400).json({ success: false, message: 'A student with this Class Roll number already exists.' });
        }
        
        await Student.create({
          name: name.trim().toUpperCase(),
          roll: roll.trim(),
          enrollment: enrollment.trim(),
          email: 'N/A',
          mobile: 'N/A'
        });
        console.log(`Student ${name} (${enrollment}) added to DB.`);
      }
    }

    try {
      if (role === 'Admin') {
        const { name, mobile, email, adminRole, department } = data;
        addAdmin(name, mobile || 'N/A', email, adminRole, department || 'CSE Data Science');
      } else if (role === 'Teacher') {
        const { name, mobile, email } = data;
        addTeacher(name, mobile || 'N/A', email);
      } else if (role === 'Student') {
        const { name, roll, enrollment } = data;
        addStudent(name, roll, enrollment);
      }
    } catch (fileErr) {
      console.warn("Excel user creation sync skipped/failed:", fileErr.message);
      if (mongoose.connection.readyState !== 1) {
        throw fileErr;
      }
    }

    res.json({ success: true, message: `${role} added successfully.` });
  } catch (err) {
    console.error('Error adding user:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/users/delete', async (req, res) => {
  const { role, identifier } = req.body;
  if (!role || !identifier) {
    return res.status(400).json({ success: false, message: 'Role and identifier are required.' });
  }

  try {
    if (mongoose.connection.readyState === 1) {
      if (role === 'Admin') {
        const emailLower = identifier.trim().toLowerCase();
        if (emailLower === 'nilanjan.chatterjee@uem.edu.in' || emailLower === 'ap2446961@gmail.com') {
          return res.status(400).json({ success: false, message: 'Default system administrator cannot be removed.' });
        }
        const result = await Admin.deleteOne({ email: emailLower });
        if (result.deletedCount === 0) {
          return res.status(400).json({ success: false, message: 'Admin user not found.' });
        }
      } else if (role === 'Teacher') {
        const emailLower = identifier.trim().toLowerCase();
        await Teacher.deleteOne({ email: emailLower });
        await Student.updateMany({ supervisorEmail: emailLower }, {
          $set: { supervisorName: null, supervisorMobile: null, supervisorEmail: null }
        });
      } else if (role === 'Student') {
        await Student.deleteOne({ enrollment: identifier.trim() });
      }
    }

    try {
      if (role === 'Admin') {
        removeAdmin(identifier);
      } else if (role === 'Teacher') {
        removeTeacher(identifier);
      } else if (role === 'Student') {
        removeStudent(identifier);
      }
    } catch (fileErr) {
      console.warn("Excel user deletion sync skipped/failed:", fileErr.message);
      if (mongoose.connection.readyState !== 1) {
        throw fileErr;
      }
    }

    res.json({ success: true, message: `${role} removed successfully.` });
  } catch (err) {
    console.error('Error removing user:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

