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
  console.log("=== STARTING YEAR & SECTION ATTENDANCE TEST ===\n");

  const testRecord = {
    date: '2026-06-07',
    subject: 'Data Structures',
    year: '2nd Year',
    section: 'Sec C',
    teacherEmail: 'ap2446961@gmail.com',
    teacherName: 'Arijit Pal',
    students: [
      {
        name: 'Arijit Pal',
        roll: '1',
        enrollment: '12024002037046',
        present: true
      }
    ]
  };

  // 1. Submit attendance with Year and Section
  console.log("1. Marking attendance with Year and Section...");
  const markRes = await makeRequest('/api/attendance/mark', 'POST', testRecord);
  const markData = await markRes.json();
  if (markData.success) {
    console.log("   [PASS] Attendance marked successfully!");
    console.log("   Record ID:", markData.record.id);
  } else {
    console.error("   [FAIL] Mark attendance failed:", markData);
    process.exit(1);
  }

  // 2. Query teacher records
  console.log("\n2. Querying teacher records to verify Year and Section...");
  const teacherRes = await makeRequest('/api/attendance/teacher/ap2446961@gmail.com', 'GET');
  const teacherData = await teacherRes.json();
  if (teacherData.success) {
    const record = teacherData.records.find(r => r.id === markData.record.id);
    if (record && record.year === '2nd Year' && record.section === 'Sec C') {
      console.log("   [PASS] Teacher records returned correct Year and Section!");
    } else {
      console.error("   [FAIL] Record not found or incorrect Year/Section in teacher response:", record);
      process.exit(1);
    }
  } else {
    console.error("   [FAIL] Fetch teacher records failed:", teacherData);
    process.exit(1);
  }

  // 3. Query student records
  console.log("\n3. Querying student records to verify Year and Section...");
  const studentRes = await makeRequest('/api/attendance/student/12024002037046', 'GET');
  const studentData = await studentRes.json();
  if (studentData.success) {
    const record = studentData.records.find(r => r.id === markData.record.id);
    if (record && record.year === '2nd Year' && record.section === 'Sec C') {
      console.log("   [PASS] Student records returned correct Year and Section!");
    } else {
      console.error("   [FAIL] Record not found or incorrect Year/Section in student response:", record);
      process.exit(1);
    }
  } else {
    console.error("   [FAIL] Fetch student records failed:", studentData);
    process.exit(1);
  }

  // 4. Clean up test record from attendance_data.json
  console.log("\n4. Cleaning up test record from database...");
  const deleteRes = await makeRequest(`/api/attendance/${markData.record.id}`, 'DELETE');
  const deleteData = await deleteRes.json();
  if (deleteData.success) {
    console.log("   [PASS] Test record deleted successfully!");
  } else {
    console.error("   [FAIL] Failed to delete test record:", deleteData);
  }

  console.log("\n=== ALL YEAR & SECTION ATTENDANCE TESTS PASSED! ===");
}

runTests().catch(err => {
  console.error("Error executing tests:", err);
  process.exit(1);
});
