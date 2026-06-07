const fs = require('fs');
const path = require('path');

const SERVER_URL = 'http://localhost:3000';

async function makeRequest(url, method, body) {
  const res = await fetch(SERVER_URL + url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : null
  });
  return res;
}

async function runTests() {
  console.log("=== STARTING LARGE PROFILE PICTURE TEST ===");

  // Create a 6MB base64 payload (representing ~4.5MB image)
  // Let's generate a string of 'A's of length 6,000,000
  const size = 6 * 1024 * 1024;
  console.log(`Generating a mock base64 image of size ~${(size / (1024 * 1024)).toFixed(2)} MB...`);
  const rawBase64 = 'A'.repeat(size);
  const mockBase64 = 'data:image/png;base64,' + rawBase64;

  console.log("Sending large image upload request to /api/profile/upload-pic...");
  const t0 = Date.now();
  const uploadRes = await makeRequest('/api/profile/upload-pic', 'POST', {
    identifier: 'ap2446961@gmail.com',
    image: mockBase64
  });
  const t1 = Date.now();
  console.log(`Request completed in ${t1 - t0}ms with status: ${uploadRes.status}`);

  const uploadData = await uploadRes.json();
  if (uploadData.success) {
    console.log("   [PASS] Large profile picture uploaded successfully!");
  } else {
    console.error("   [FAIL] Upload failed:", uploadData);
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Error executing tests:", err);
  process.exit(1);
});
