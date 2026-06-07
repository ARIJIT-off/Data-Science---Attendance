const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const SERVER_URL = 'http://localhost:3000';
const LOG_FILE = process.argv[2];

if (!LOG_FILE || !fs.existsSync(LOG_FILE)) {
  console.error("Error: Please provide a valid log file path as argument 1");
  process.exit(1);
}

// Helper for requests
async function makeRequest(url, method, body) {
  const res = await fetch(SERVER_URL + url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : null
  });
  return res.json();
}

// Helper to perform full OTP Login flow
async function performOTPLogin(email, role) {
  // 1. Send OTP
  const sendRes = await makeRequest('/api/send-otp', 'POST', { email, role });
  if (!sendRes.success) {
    console.error(`   [FAIL] Send OTP request failed for ${email}:`, sendRes);
    process.exit(1);
  }
  
  // Wait for logs to flush
  await new Promise(r => setTimeout(r, 1200));
  
  // 2. Read OTP from log
  const content = fs.readFileSync(LOG_FILE, 'utf8');
  // Match regex: OTP (\d{4}) successfully sent to email
  const regex = new RegExp(`OTP \\((\\d{4})\\) successfully sent to ${email.replace(/\./g, '\\.')}`, 'g');
  const matches = [...content.matchAll(regex)];
  if (matches.length === 0) {
    console.error(`   [FAIL] Could not extract OTP from logs for ${email}. Log matches:`);
    console.log(content.slice(-500));
    process.exit(1);
  }
  const otp = matches[matches.length - 1][1];
  
  // 3. Verify OTP
  const verifyRes = await makeRequest('/api/verify-otp', 'POST', { email, otp });
  return verifyRes;
}

// Helper to find email change OTP from server log
function getEmailChangeOTP() {
  const content = fs.readFileSync(LOG_FILE, 'utf8');
  const matches = [...content.matchAll(/Email Change OTP \((\d{4})\) sent to ap2446961@gmail\.com/g)];
  return matches.length > 0 ? matches[matches.length - 1][1] : null;
}

async function runTests() {
  console.log("=== STARTING AUTOMATED EMAIL CHANGE & OTP LOGIN TESTS ===\n");

  // 1. OTP Login with old email as Admin
  console.log("1. Testing OTP Login as Admin with old email (arijitp203@gmail.com)...");
  const loginRes1 = await performOTPLogin('arijitp203@gmail.com', 'Admin');
  
  if (loginRes1.success && loginRes1.user.email === 'arijitp203@gmail.com') {
    console.log("   [PASS] Login successful!");
  } else {
    console.error("   [FAIL] Login failed:", loginRes1);
    process.exit(1);
  }

  // 2. Request email change
  console.log("\n2. Requesting email change to new email (ap2446961@gmail.com)...");
  const changeRes = await makeRequest('/api/email-change/send-otp', 'POST', {
    currentEmail: 'arijitp203@gmail.com',
    newEmail: 'ap2446961@gmail.com',
    role: 'Admin'
  });
  
  if (changeRes.success) {
    console.log("   [PASS] OTP request sent successfully!");
  } else {
    console.error("   [FAIL] OTP request failed:", changeRes);
    process.exit(1);
  }

  // Wait 1 second for logs to write, then read OTP
  console.log("   Waiting for log update...");
  await new Promise(r => setTimeout(r, 1200));
  
  const otp = getEmailChangeOTP();
  if (otp) {
    console.log(`   [PASS] Successfully extracted OTP from log: ${otp}`);
  } else {
    console.error("   [FAIL] Failed to extract OTP from logs. Log content:");
    console.log(fs.readFileSync(LOG_FILE, 'utf8').slice(-500));
    process.exit(1);
  }

  // 3. Verify OTP and change email
  console.log("\n3. Verifying OTP...");
  const verifyRes = await makeRequest('/api/email-change/verify-otp', 'POST', {
    newEmail: 'ap2446961@gmail.com',
    otp: otp
  });
  
  if (verifyRes.success && verifyRes.user.email === 'ap2446961@gmail.com') {
    console.log("   [PASS] Email change verified successfully!");
  } else {
    console.error("   [FAIL] OTP verification failed:", verifyRes);
    process.exit(1);
  }

  // 4. Verify spreadsheet updates
  console.log("\n4. Verifying spreadsheet updates...");
  const adminWb = xlsx.readFile('admin data.xlsx');
  const adminData = xlsx.utils.sheet_to_json(adminWb.Sheets[adminWb.SheetNames[0]]);
  const adminMatch = adminData.find(r => r.Name === 'Arijit Pal');
  
  const teacherWb = xlsx.readFile('teacher data.xlsx');
  const teacherData = xlsx.utils.sheet_to_json(teacherWb.Sheets[teacherWb.SheetNames[0]]);
  const teacherMatch = teacherData.find(r => r['Additional Name'] === 'Arijit Pal');
  
  if (adminMatch && adminMatch.Email === 'ap2446961@gmail.com') {
    console.log("   [PASS] admin data.xlsx updated successfully!");
  } else {
    console.error("   [FAIL] admin data.xlsx not updated. Row:", adminMatch);
    process.exit(1);
  }
  
  if (teacherMatch && teacherMatch['Additional Email'] === 'ap2446961@gmail.com') {
    console.log("   [PASS] teacher data.xlsx updated successfully!");
  } else {
    console.error("   [FAIL] teacher data.xlsx not updated. Row:", teacherMatch);
    process.exit(1);
  }

  // 5. Test login with NEW email as Admin (via OTP)
  console.log("\n5. Testing OTP Login as Admin with NEW email (ap2446961@gmail.com)...");
  const loginRes2 = await performOTPLogin('ap2446961@gmail.com', 'Admin');
  
  if (loginRes2.success && loginRes2.user.email === 'ap2446961@gmail.com') {
    console.log("   [PASS] Login with new email successful!");
  } else {
    console.error("   [FAIL] Login failed:", loginRes2);
    process.exit(1);
  }

  // 6. Test login with NEW email as Teacher (via OTP)
  console.log("\n6. Testing OTP Login as Teacher with NEW email (ap2446961@gmail.com)...");
  const loginRes3 = await performOTPLogin('ap2446961@gmail.com', 'Teacher');
  
  if (loginRes3.success && loginRes3.user.email === 'ap2446961@gmail.com') {
    console.log("   [PASS] Login as Teacher with new email successful!");
  } else {
    console.error("   [FAIL] Login failed:", loginRes3);
    process.exit(1);
  }

  console.log("\n=== ALL TESTS PASSED SUCCESSFULLY! ===");
}

runTests().catch(err => {
  console.error("Test execution error:", err);
  process.exit(1);
});
