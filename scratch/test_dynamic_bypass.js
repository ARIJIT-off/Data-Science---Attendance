const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const SERVER_URL = 'http://localhost:3000';
const LOG_FILE = process.argv[2];

if (!LOG_FILE || !fs.existsSync(LOG_FILE)) {
  console.error("Error: Please provide a valid log file path as argument 1");
  process.exit(1);
}

async function makeRequest(url, method, body) {
  const res = await fetch(SERVER_URL + url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : null
  });
  return res.json();
}

async function performOTPLogin(email, role) {
  // 1. Send OTP
  const sendRes = await makeRequest('/api/send-otp', 'POST', { email, role });
  if (!sendRes.success) {
    return sendRes;
  }
  
  // Wait for logs to flush
  await new Promise(r => setTimeout(r, 1200));
  
  // 2. Read OTP from log
  const content = fs.readFileSync(LOG_FILE, 'utf8');
  const regex = new RegExp(`OTP \\((\\d{4})\\) successfully sent to ${email.replace(/\./g, '\\.')}`, 'g');
  const matches = [...content.matchAll(regex)];
  if (matches.length === 0) {
    console.error(`   [FAIL] Could not extract OTP from logs for ${email}.`);
    process.exit(1);
  }
  const otp = matches[matches.length - 1][1];
  
  // 3. Verify OTP
  const verifyRes = await makeRequest('/api/verify-otp', 'POST', { email, otp });
  return verifyRes;
}

function getEmailChangeOTP(newEmail) {
  const content = fs.readFileSync(LOG_FILE, 'utf8');
  const escaped = newEmail.replace(/\./g, '\\.');
  const regex = new RegExp(`Email Change OTP \\((\\d{4})\\) sent to ${escaped}`, 'g');
  const matches = [...content.matchAll(regex)];
  return matches.length > 0 ? matches[matches.length - 1][1] : null;
}

async function runTests() {
  console.log("=== STARTING DYNAMIC BYPASS & LOGIN RESTRICTION TESTS ===\n");

  // Current email is chak.ayantika@gmail.com
  console.log("1. Testing login with CURRENT email (chak.ayantika@gmail.com)...");
  const loginRes1 = await performOTPLogin('chak.ayantika@gmail.com', 'Admin');
  if (loginRes1.success) {
    console.log("   [PASS] Login with current email succeeded!");
  } else {
    console.error("   [FAIL] Login with current email failed:", loginRes1);
    process.exit(1);
  }

  console.log("\n2. Testing login with OLD email (ap2446961@gmail.com)...");
  const loginRes2 = await performOTPLogin('ap2446961@gmail.com', 'Admin');
  if (!loginRes2.success) {
    console.log("   [PASS] Login with old email was correctly BLOCKED! Message:", loginRes2.message);
  } else {
    console.error("   [FAIL] Login with old email was ALLOWED! This is a security flaw:", loginRes2);
    process.exit(1);
  }

  console.log("\n3. Requesting email change from chak.ayantika@gmail.com back to ap2446961@gmail.com...");
  const changeRes = await makeRequest('/api/email-change/send-otp', 'POST', {
    currentEmail: 'chak.ayantika@gmail.com',
    newEmail: 'ap2446961@gmail.com',
    role: 'Admin'
  });
  if (changeRes.success) {
    console.log("   [PASS] Email change OTP sent successfully.");
  } else {
    console.error("   [FAIL] Email change request failed:", changeRes);
    process.exit(1);
  }

  await new Promise(r => setTimeout(r, 1200));
  const otp = getEmailChangeOTP('ap2446961@gmail.com');
  if (otp) {
    console.log(`   [PASS] Extracted email change OTP: ${otp}`);
  } else {
    console.error("   [FAIL] Could not extract email change OTP from logs.");
    process.exit(1);
  }

  console.log("\n4. Verifying email change...");
  const verifyRes = await makeRequest('/api/email-change/verify-otp', 'POST', {
    newEmail: 'ap2446961@gmail.com',
    otp: otp
  });
  if (verifyRes.success) {
    console.log("   [PASS] Email change verified successfully!");
  } else {
    console.error("   [FAIL] Email change verification failed:", verifyRes);
    process.exit(1);
  }

  console.log("\n5. Testing login with NEW current email (ap2446961@gmail.com)...");
  const loginRes3 = await performOTPLogin('ap2446961@gmail.com', 'Admin');
  if (loginRes3.success) {
    console.log("   [PASS] Login with new email succeeded!");
  } else {
    console.error("   [FAIL] Login with new email failed:", loginRes3);
    process.exit(1);
  }

  console.log("\n6. Testing login with OLD email (chak.ayantika@gmail.com)...");
  const loginRes4 = await performOTPLogin('chak.ayantika@gmail.com', 'Admin');
  if (!loginRes4.success) {
    console.log("   [PASS] Login with old email was correctly BLOCKED! Message:", loginRes4.message);
  } else {
    console.error("   [FAIL] Login with old email was ALLOWED! Security issue:", loginRes4);
    process.exit(1);
  }

  console.log("\n=== ALL DYNAMIC BYPASS & SECURITY TESTS PASSED! ===");
}

runTests().catch(err => {
  console.error("Error executing tests:", err);
  process.exit(1);
});
