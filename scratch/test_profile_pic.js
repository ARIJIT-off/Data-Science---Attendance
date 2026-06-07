const fs = require('fs');
const path = require('path');

const SERVER_URL = 'http://localhost:3000';
const LOG_FILE = process.argv[2];
const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads', 'profile_pics');

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
  return res;
}

// Helper to find email change OTP from server log
function getEmailChangeOTP(newEmail) {
  const content = fs.readFileSync(LOG_FILE, 'utf8');
  const escaped = newEmail.replace(/\./g, '\\.');
  const regex = new RegExp(`Email Change OTP \\((\\d{4})\\) sent to ${escaped}`, 'g');
  const matches = [...content.matchAll(regex)];
  return matches.length > 0 ? matches[matches.length - 1][1] : null;
}

async function runTests() {
  console.log("=== STARTING PROFILE PICTURE & EMAIL SYNC TESTS ===\n");

  const mockBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; // 1x1 transparent png

  // 1. Upload profile pic for chak.ayantika@gmail.com
  console.log("1. Uploading profile picture for chak.ayantika@gmail.com...");
  const uploadRes = await makeRequest('/api/profile/upload-pic', 'POST', {
    identifier: 'chak.ayantika@gmail.com',
    image: mockBase64
  });
  const uploadData = await uploadRes.json();
  if (uploadData.success) {
    console.log("   [PASS] Profile picture uploaded successfully!");
  } else {
    console.error("   [FAIL] Upload failed:", uploadData);
    process.exit(1);
  }

  // Verify file on disk
  const expectedFile = path.join(UPLOADS_DIR, 'chak.ayantika@gmail.com.png');
  if (fs.existsSync(expectedFile)) {
    console.log("   [PASS] File exists on disk!");
  } else {
    console.error(`   [FAIL] File not found at ${expectedFile}`);
    process.exit(1);
  }

  // 2. Fetch via GET endpoint
  console.log("2. Querying profile picture via GET endpoint...");
  const getRes = await makeRequest('/api/profile/pic/chak.ayantika@gmail.com', 'GET');
  if (getRes.status === 200) {
    console.log("   [PASS] Endpoint served the image successfully!");
  } else {
    console.error(`   [FAIL] GET request returned status: ${getRes.status}`);
    process.exit(1);
  }

  // 3. Request email change to ap2446961@gmail.com
  console.log("\n3. Requesting email change to ap2446961@gmail.com (to trigger rename)...");
  const changeRes = await makeRequest('/api/email-change/send-otp', 'POST', {
    currentEmail: 'chak.ayantika@gmail.com',
    newEmail: 'ap2446961@gmail.com',
    role: 'Admin'
  });
  const changeData = await changeRes.json();
  if (changeData.success) {
    console.log("   [PASS] OTP sent successfully.");
  } else {
    console.error("   [FAIL] Email change request failed:", changeData);
    process.exit(1);
  }

  // Wait 1 second for logs to flush
  await new Promise(r => setTimeout(r, 1200));
  const otp = getEmailChangeOTP('ap2446961@gmail.com');
  if (otp) {
    console.log(`   [PASS] Extracted OTP: ${otp}`);
  } else {
    console.error("   [FAIL] Failed to extract OTP from log.");
    process.exit(1);
  }

  // 4. Verify email change
  console.log("\n4. Verifying OTP and completing email change...");
  const verifyRes = await makeRequest('/api/email-change/verify-otp', 'POST', {
    newEmail: 'ap2446961@gmail.com',
    otp: otp
  });
  const verifyData = await verifyRes.json();
  if (verifyData.success) {
    console.log("   [PASS] Email change completed!");
  } else {
    console.error("   [FAIL] Email change verification failed:", verifyData);
    process.exit(1);
  }

  // 5. Verify profile picture renaming on disk
  console.log("\n5. Checking renamed profile picture on disk...");
  const oldPath = path.join(UPLOADS_DIR, 'chak.ayantika@gmail.com.png');
  const newPath = path.join(UPLOADS_DIR, 'ap2446961@gmail.com.png');

  if (fs.existsSync(newPath)) {
    console.log("   [PASS] New profile picture file exists at ap2446961@gmail.com.png!");
  } else {
    console.error("   [FAIL] Renamed file not found!");
    process.exit(1);
  }

  if (!fs.existsSync(oldPath)) {
    console.log("   [PASS] Old profile picture file was cleaned up successfully!");
  } else {
    console.error("   [FAIL] Old file still exists!");
    process.exit(1);
  }

  // 6. Verify GET endpoints
  console.log("\n6. Querying GET endpoints for old and new email...");
  const getOldRes = await makeRequest('/api/profile/pic/chak.ayantika@gmail.com', 'GET');
  const getNewRes = await makeRequest('/api/profile/pic/ap2446961@gmail.com', 'GET');

  if (getOldRes.status === 404) {
    console.log("   [PASS] Old email query returned 404 (Correct!).");
  } else {
    console.error(`   [FAIL] Old email query returned status: ${getOldRes.status}`);
    process.exit(1);
  }

  if (getNewRes.status === 200) {
    console.log("   [PASS] New email query returned 200 (Correct!).");
  } else {
    console.error(`   [FAIL] New email query returned status: ${getNewRes.status}`);
    process.exit(1);
  }

  console.log("\n=== ALL PROFILE PICTURE & EMAIL SYNC TESTS PASSED! ===");
}

runTests().catch(err => {
  console.error("Error executing tests:", err);
  process.exit(1);
});
