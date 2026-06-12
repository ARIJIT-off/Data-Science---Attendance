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
const otpCache = new Map();

// Helper: load SMTP credentials from mailmain.xlsx
function loadCredentials() {
  try {
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
      throw new Error("Credentials not found in Excel columns. Ensure Row 2 has Email Address and Row 3 has App Password.");
    }

    console.log(`Loaded credentials successfully: Sender Email is ${email}`);
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

// Helper: Read sheet data dynamically
function readExcelFile(filename) {
  const filePath = path.join(__dirname, filename);
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet);
}

// Helper: Search and validate user by Role and Email
function findUserByRole(email, role) {
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
  } catch (e) {
    console.error("Error reading Arijit Pal email from admin data:", e.message);
  }
  
  try {
    const teacherRows = readExcelFile('teacher data.xlsx');
    const teacherRow = teacherRows.find(r => r['Additional Name'] === 'Arijit Pal');
    if (teacherRow && teacherRow['Additional Email']) {
      arijitTeacherEmail = teacherRow['Additional Email'].toString().trim().toLowerCase();
    }
  } catch (e) {
    console.error("Error reading Arijit Pal email from teacher data:", e.message);
  }

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
  
  if (role === 'Admin') {
    try {
      const rows = readExcelFile('admin data.xlsx');
      const userRow = rows.find(r => r.Email && r.Email.toString().trim().toLowerCase() === emailLower);
      if (userRow) {
        const userRole = userRow.Role ? userRow.Role.toString().trim().toUpperCase() : '';
        // Admin matches HOD and A.HOD (any role except Student)
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
      // Look up under Supervisor Email
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
      // 1. Look up in admin data.xlsx for matching Student
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
      
      // 2. Look up in teacher data.xlsx to link supervisor details if available
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
function findStudentByEnrollmentAndRoll(enrollmentNo, rollNo) {
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
    const yearColIndex = data[headerRowIndex].indexOf('Year');
    const sectionColIndex = data[headerRowIndex].indexOf('Section');

    const enteredEnrollClean = enrollmentNo.toString().trim().toLowerCase();
    const enteredRollClean = rollNo.toString().trim();

    // First pass: look for exact match on both roll and enrollment
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (row && row[rollColIndex] !== undefined && row[enrollColIndex] !== undefined) {
        const rowRoll = row[rollColIndex].toString().trim();
        const rowEnroll = row[enrollColIndex].toString().trim();
        if (rowRoll === enteredRollClean && rowEnroll.toLowerCase() === enteredEnrollClean) {
          return {
            name: row[nameColIndex] ? row[nameColIndex].toString().trim() : '',
            roll: rowRoll,
            enrollment: rowEnroll,
            year: yearColIndex !== -1 && row[yearColIndex] ? row[yearColIndex].toString().trim() : '2nd Year',
            section: sectionColIndex !== -1 && row[sectionColIndex] ? row[sectionColIndex].toString().trim() : 'Sec A'
          };
        }
      }
    }

    // Second pass: fallback to suffix/endsWith matches if no exact match found
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (row && row[rollColIndex] !== undefined && row[enrollColIndex] !== undefined) {
        const rowRoll = row[rollColIndex].toString().trim();
        const rowEnroll = row[enrollColIndex].toString().trim();
        const cleanRowEnroll = rowEnroll.replace(/\D/g, '');
        const cleanEnteredEnroll = enteredEnrollClean.replace(/\D/g, '');
        
        const isRollMatch = rowRoll === enteredRollClean;
        const isEnrollMatch = (cleanRowEnroll.endsWith(cleanEnteredEnroll)) ||
                              (cleanEnteredEnroll.endsWith(cleanRowEnroll)) ||
                              (cleanRowEnroll.slice(-6) === cleanEnteredEnroll.slice(-6));
        
        if (isRollMatch && isEnrollMatch) {
          return {
            name: row[nameColIndex] ? row[nameColIndex].toString().trim() : '',
            roll: rowRoll,
            enrollment: rowEnroll,
            year: yearColIndex !== -1 && row[yearColIndex] ? row[yearColIndex].toString().trim() : '2nd Year',
            section: sectionColIndex !== -1 && row[sectionColIndex] ? row[sectionColIndex].toString().trim() : 'Sec A'
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
    
    // Safety check / bypass for Arijit Pal
    if (studentInfo.name.toLowerCase().includes('arijit pal')) {
      userEmail = findStudentEmailByName(studentInfo.name) || 'ap2446961@gmail.com';
    }
    
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
    await transporter.sendMail(mailOptions);
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
app.post('/api/attendance/mark', (req, res) => {
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

  const data = readAttendanceData();
  data.push(record);
  writeAttendanceData(data);

  console.log(`Attendance marked by ${teacherName} for ${subject} (${year} - ${section}) on ${date} — ${students.filter(s => s.present).length}/${students.length} present`);
  res.json({ success: true, message: 'Attendance recorded successfully.', record });
});

// Endpoint: Get student's attendance records by enrollment number
app.get('/api/attendance/student/:enrollment', (req, res) => {
  const enrollment = decodeURIComponent(req.params.enrollment).trim();
  const allRecords = readAttendanceData();

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
app.get('/api/attendance/teacher/:email', (req, res) => {
  const email = decodeURIComponent(req.params.email).trim().toLowerCase();
  const allRecords = readAttendanceData();

  const teacherRecords = allRecords.filter(record =>
    record.teacherEmail === email
  );

  res.json({ success: true, records: teacherRecords });
});

// Endpoint: Get all attendance records (for admin)
app.get('/api/attendance/all', (req, res) => {
  const allRecords = readAttendanceData();
  res.json({ success: true, records: allRecords });
});

// Endpoint: Get attendance statistics (for admin)
app.get('/api/attendance/stats', (req, res) => {
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
app.delete('/api/attendance/:id', (req, res) => {
  const id = req.params.id;
  let data = readAttendanceData();
  const initialLength = data.length;
  data = data.filter(record => record.id !== id);

  if (data.length === initialLength) {
    return res.status(404).json({ success: false, message: 'Record not found.' });
  }

  writeAttendanceData(data);
  res.json({ success: true, message: 'Record deleted successfully.' });
});

// Endpoint: Update student status in an attendance record (for admin)
app.patch('/api/attendance/:recordId/student/:enrollment', (req, res) => {
  const { recordId, enrollment } = req.params;
  const { present } = req.body;

  if (present === undefined) {
    return res.status(400).json({ success: false, message: 'Missing "present" status in request body.' });
  }

  const data = readAttendanceData();
  const record = data.find(r => r.id === recordId);

  if (!record) {
    return res.status(404).json({ success: false, message: 'Attendance record not found.' });
  }

  const student = record.students.find(s => s.enrollment === enrollment);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found in this record.' });
  }

  student.present = !!present;
  writeAttendanceData(data);

  console.log(`Admin updated attendance in record ${recordId}: Student ${student.name} (${enrollment}) set to ${present ? 'Present' : 'Absent'}`);
  res.json({ success: true, message: 'Student status updated successfully.', record });
});

// Endpoint: Submit a student or teacher grievance
app.post('/api/grievance', (req, res) => {
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

  const data = readGrievanceData();
  data.push(record);
  writeGrievanceData(data);

  console.log(`Grievance submitted by ${role} ${name} (${senderEmail || studentEnrollment})`);
  res.json({ success: true, message: 'Grievance submitted successfully.', grievance: record });
});

// Endpoint: Get all student grievances (for admin only)
app.get('/api/grievances', (req, res) => {
  const data = readGrievanceData();
  res.json({ success: true, grievances: data });
});

// Endpoint: Delete a student grievance (for admin only)
app.delete('/api/grievance/:id', (req, res) => {
  const id = req.params.id;
  let data = readGrievanceData();
  const initialLength = data.length;
  data = data.filter(g => g.id !== id);

  if (data.length === initialLength) {
    return res.status(404).json({ success: false, message: 'Grievance not found.' });
  }

  writeGrievanceData(data);
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
    await transporter.sendMail(mailOptions);
    console.log(`Email Change OTP (${otp}) sent to ${newEmail} for role ${role}`);
    res.status(200).json({ success: true, message: 'Verification code sent to your new email.' });
  } catch (error) {
    console.error(`Error sending email change OTP to ${newEmail}:`, error);
    res.status(500).json({ success: false, message: 'Failed to send verification email. Please try again.' });
  }
});

// Endpoint: Verify OTP & Apply Email Change
app.post('/api/email-change/verify-otp', (req, res) => {
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
  const oldProfile = findUserByRole(currentEmail, role);

  // Clear OTP on success
  otpCache.delete(cacheKey);

  // Update Excel sheets
  updateEmailInExcels(currentEmail, newEmail, role);

  // Rename profile picture file if it exists
  handleEmailChangeProfilePic(currentEmail, newEmail);


  // Return new user details so frontend can update its sessionStorage
  let newProfile = findUserByRole(newEmail, role);
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
app.get('/api/profile/pic/:identifier', (req, res) => {
  const identifier = decodeURIComponent(req.params.identifier).trim().toLowerCase();
  
  if (!identifier) {
    return res.status(400).send('Identifier is required.');
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
app.post('/api/profile/upload-pic', (req, res) => {
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

  ensureUploadsDir();

  try {
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

    res.json({ success: true, message: 'Profile picture uploaded successfully.' });
  } catch (err) {
    console.error("Error saving profile picture:", err.message);
    res.status(500).json({ success: false, message: 'Server failed to save the profile picture.' });
  }
});

// ============================================================
// LIVE ATTENDANCE SESSION API ENDPOINTS
// ============================================================

// Endpoint: Teacher creates a live session
app.post('/api/session/create', (req, res) => {
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

  const sessions = readSessionsData();
  sessions.push(session);
  writeSessionsData(sessions);

  console.log(`Live session created by ${teacherName} for ${subject} (${year} - ${section}) on ${date} | Token: ${token}`);
  res.json({ success: true, token, message: 'Session created.' });
});

// Endpoint: Get session info by token (used by student to preview)
app.get('/api/session/:token', (req, res) => {
  const { token } = req.params;
  const { enrollment, year, section } = req.query;
  const sessions = readSessionsData();
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
app.get('/api/session/:token/poll', (req, res) => {
  const { token } = req.params;
  const sessions = readSessionsData();
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
app.post('/api/session/:token/mark', (req, res) => {
  const { token } = req.params;
  const { name, roll, enrollment, year, section } = req.body;

  if (!name || !roll || !enrollment) {
    return res.status(400).json({ success: false, message: 'Student name, roll, and enrollment are required.' });
  }

  const sessions = readSessionsData();
  const sessionIndex = sessions.findIndex(s => s.token === token);

  if (sessionIndex === -1) {
    return res.status(404).json({ success: false, message: 'Session not found. The link may be invalid.' });
  }

  const session = sessions[sessionIndex];

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
    session.status = 'expired';
    sessions[sessionIndex] = session;
    writeSessionsData(sessions);
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
    markedAt: new Date().toISOString()
  });

  sessions[sessionIndex] = session;
  writeSessionsData(sessions);

  console.log(`Student ${name} (${enrollment}) marked present in session ${token}`);
  res.json({ success: true, message: `Your attendance has been marked! ✅` });
});

// Endpoint: Teacher closes session and records attendance into the main attendance system
app.post('/api/session/:token/close', (req, res) => {
  const { token } = req.params;
  const sessions = readSessionsData();
  const sessionIndex = sessions.findIndex(s => s.token === token);

  if (sessionIndex === -1) {
    return res.status(404).json({ success: false, message: 'Session not found.' });
  }

  const session = sessions[sessionIndex];

  if (session.status === 'closed') {
    return res.json({ success: true, alreadyClosed: true, message: 'Session already closed and attendance recorded.' });
  }

  // Close the session
  session.status = 'closed';
  session.closedAt = new Date().toISOString();
  sessions[sessionIndex] = session;
  writeSessionsData(sessions);

  // Get full student list to include all students (marked = present, rest = absent)
  const allStudents = getAllStudents();
  const markedEnrollments = new Set(session.markedStudents.map(s => s.enrollment));

  let studentsForRecord;
  if (allStudents.length > 0) {
    // Filter by year & section to only include students meant to be in this class
    const filteredStudents = allStudents.filter(s => s.year === session.year && s.section === session.section);

    // Smart strategy: students who marked themselves are present; all others in the class are absent
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

  // Only record if at least one student marked present
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

  const attendanceData = readAttendanceData();
  attendanceData.push(record);
  writeAttendanceData(attendanceData);

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

app.get('/api/admin/users', (req, res) => {
  try {
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

app.post('/api/admin/users/add', (req, res) => {
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
      addAdmin(name, mobile || 'N/A', email, adminRole, department || 'CSE Data Science');
      console.log(`Admin ${name} (${email}) added by admin.`);
      res.json({ success: true, message: 'Admin user added successfully.' });
    } 
    else if (role === 'Teacher') {
      const { name, mobile, email } = data;
      if (!name || !email) {
        return res.status(400).json({ success: false, message: 'Name and email are required.' });
      }
      addTeacher(name, mobile || 'N/A', email);
      console.log(`Teacher ${name} (${email}) added by admin.`);
      res.json({ success: true, message: 'Teacher added successfully.' });
    } 
    else if (role === 'Student') {
      const { name, roll, enrollment, year, section } = data;
      if (!name || !roll || !enrollment) {
        return res.status(400).json({ success: false, message: 'Name, Class Roll, and Enrollment Number are required.' });
      }
      addStudent(name, roll, enrollment, year || '2nd Year', section || 'Sec A');
      console.log(`Student ${name} (${enrollment}) added by admin.`);
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

app.post('/api/admin/users/bulk-add-students', (req, res) => {
  const { students, year, section } = req.body;
  if (!students || !Array.isArray(students)) {
    return res.status(400).json({ success: false, message: 'Invalid data format. Expected an array of students.' });
  }

  try {
    const result = bulkAddStudents(students, year || '2nd Year', section || 'Sec A');
    res.json({
      success: true,
      message: `Bulk import completed. Successfully added ${result.addedCount} students. Skipped ${result.skippedCount} rows.`,
      addedCount: result.addedCount,
      skippedCount: result.skippedCount,
      errors: result.errors
    });
  } catch (err) {
    console.error('Error during bulk student import:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/users/delete', (req, res) => {
  const { role, identifier } = req.body;
  if (!role || !identifier) {
    return res.status(400).json({ success: false, message: 'Role and identifier are required.' });
  }

  try {
    if (role === 'Admin') {
      removeAdmin(identifier);
      console.log(`Admin ${identifier} removed by admin.`);
      res.json({ success: true, message: 'Admin user removed successfully.' });
    } 
    else if (role === 'Teacher') {
      removeTeacher(identifier);
      console.log(`Teacher ${identifier} removed by admin.`);
      res.json({ success: true, message: 'Teacher removed successfully.' });
    } 
    else if (role === 'Student') {
      removeStudent(identifier);
      console.log(`Student ${identifier} removed by admin.`);
      res.json({ success: true, message: 'Student removed successfully.' });
    } 
    else {
      res.status(400).json({ success: false, message: 'Invalid role type.' });
    }
  } catch (err) {
    console.error('Error removing user:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/users/delete-bulk-class', (req, res) => {
  const { year, section } = req.body;
  if (!year || !section) {
    return res.status(400).json({ success: false, message: 'Year and section are required.' });
  }

  try {
    const deletedCount = removeStudentsByClass(year, section);
    console.log(`Bulk deleted ${deletedCount} student(s) for ${year} - ${section}.`);
    res.json({
      success: true,
      message: `Successfully deleted ${deletedCount} student(s) for ${year} ${section}.`,
      deletedCount
    });
  } catch (err) {
    console.error('Error in bulk student deletion:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== Subject Management Helpers & APIs =====
const SUBJECTS_FILE = path.join(__dirname, 'subjects.json');

function readSubjects() {
  try {
    if (!fs.existsSync(SUBJECTS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(SUBJECTS_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading subjects file:', err.message);
    return [];
  }
}

function writeSubjects(subjects) {
  try {
    fs.writeFileSync(SUBJECTS_FILE, JSON.stringify(subjects, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing subjects file:', err.message);
  }
}

app.get('/api/admin/subjects', (req, res) => {
  try {
    const subjects = readSubjects();
    res.json({ success: true, subjects });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.post('/api/admin/subjects/add', (req, res) => {
  const { year, semester, subjectName, subjectCode } = req.body;
  if (!year || !semester || !subjectName || !subjectCode) {
    return res.status(400).json({ success: false, message: 'Year, semester, subject name, and subject code are required.' });
  }

  try {
    const subjects = readSubjects();
    const cleanYear = year.toString().trim();
    const cleanSemester = semester.toString().trim();
    const cleanName = subjectName.toString().trim();
    const cleanCode = subjectCode.toString().trim().toUpperCase();

    // Check duplicate code or duplicate name for same year and semester
    const duplicateCode = subjects.some(s => s.year === cleanYear && s.semester === cleanSemester && s.subjectCode.toUpperCase() === cleanCode);
    const duplicateName = subjects.some(s => s.year === cleanYear && s.semester === cleanSemester && s.subjectName.toLowerCase() === cleanName.toLowerCase());

    if (duplicateCode) {
      return res.status(400).json({ success: false, message: `Subject code "${cleanCode}" already exists for ${cleanYear} (${cleanSemester}).` });
    }
    if (duplicateName) {
      return res.status(400).json({ success: false, message: `Subject name "${cleanName}" already exists for ${cleanYear} (${cleanSemester}).` });
    }

    const newSubject = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
      year: cleanYear,
      semester: cleanSemester,
      subjectName: cleanName,
      subjectCode: cleanCode
    };

    subjects.push(newSubject);
    writeSubjects(subjects);
    res.json({ success: true, message: 'Subject added successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/subjects/bulk-add', (req, res) => {
  const { subjects: newSubjects } = req.body;
  if (!newSubjects || !Array.isArray(newSubjects)) {
    return res.status(400).json({ success: false, message: 'Invalid data format. Expected an array of subjects.' });
  }

  try {
    const subjects = readSubjects();
    
    // Create sets of existing subject codes and subject names (year + '|' + semester + '|' + identifier)
    const existingCodeKeys = new Set(subjects.map(s => `${s.year.toLowerCase()}|${(s.semester || '').toLowerCase()}|${s.subjectCode.toLowerCase()}`));
    const existingNameKeys = new Set(subjects.map(s => `${s.year.toLowerCase()}|${(s.semester || '').toLowerCase()}|${s.subjectName.toLowerCase()}`));
    
    let addedCount = 0;
    let skippedCount = 0;
    const errors = [];

    newSubjects.forEach((sub, index) => {
      const { year, semester, subjectName, subjectCode } = sub;
      if (!year || !semester || !subjectName || !subjectCode) {
        errors.push(`Row ${index + 2}: Year, Semester, Subject Name, and Subject Code are required.`);
        skippedCount++;
        return;
      }

      const cleanYear = year.toString().trim();
      const cleanSemester = semester.toString().trim();
      const cleanName = subjectName.toString().trim();
      const cleanCode = subjectCode.toString().trim().toUpperCase();
      
      const codeKey = `${cleanYear.toLowerCase()}|${cleanSemester.toLowerCase()}|${cleanCode.toLowerCase()}`;
      const nameKey = `${cleanYear.toLowerCase()}|${cleanSemester.toLowerCase()}|${cleanName.toLowerCase()}`;

      if (existingCodeKeys.has(codeKey)) {
        errors.push(`Row ${index + 2}: Subject code "${cleanCode}" already exists for ${cleanYear} (${cleanSemester}).`);
        skippedCount++;
        return;
      }

      if (existingNameKeys.has(nameKey)) {
        errors.push(`Row ${index + 2}: Subject name "${cleanName}" already exists for ${cleanYear} (${cleanSemester}).`);
        skippedCount++;
        return;
      }

      const newSubject = {
        id: (Date.now() + index).toString() + Math.random().toString(36).substring(2, 7),
        year: cleanYear,
        semester: cleanSemester,
        subjectName: cleanName,
        subjectCode: cleanCode
      };

      subjects.push(newSubject);
      existingCodeKeys.add(codeKey);
      existingNameKeys.add(nameKey);
      addedCount++;
    });

    if (addedCount > 0) {
      writeSubjects(subjects);
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

app.post('/api/admin/subjects/delete-bulk', (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ success: false, message: 'Invalid data format. Expected an array of subject IDs.' });
  }

  try {
    let subjects = readSubjects();
    const beforeCount = subjects.length;
    subjects = subjects.filter(s => !ids.includes(s.id));
    const deletedCount = beforeCount - subjects.length;

    writeSubjects(subjects);
    res.json({ success: true, message: `Successfully deleted ${deletedCount} subject(s) in bulk.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/subjects/delete-bulk-class', (req, res) => {
  const { year, semester } = req.body;
  if (!year || !semester) {
    return res.status(400).json({ success: false, message: 'Year and semester are required.' });
  }

  try {
    const subjects = readSubjects();
    const cleanYear = year.toString().trim();
    const cleanSemester = semester.toString().trim();

    const filtered = subjects.filter(s => !(s.year === cleanYear && s.semester === cleanSemester));
    const deletedCount = subjects.length - filtered.length;

    writeSubjects(filtered);
    res.json({
      success: true,
      message: `Successfully deleted ${deletedCount} subject(s) for ${cleanYear} (${cleanSemester}).`,
      deletedCount
    });
  } catch (err) {
    console.error('Error in bulk subjects deletion:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

