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
  console.log("=== STARTING ADMIN ATTENDANCE TOGGLE TEST ===\n");

  const testRecord = {
    date: '2026-06-07',
    subject: 'Web Technologies',
    year: '3rd Year',
    section: 'Sec A',
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

  // 1. Submit attendance with student Present
  console.log("1. Marking attendance with student marked as Present...");
  const markRes = await makeRequest('/api/attendance/mark', 'POST', testRecord);
  const markData = await markRes.json();
  if (markData.success) {
    console.log("   [PASS] Attendance marked successfully!");
  } else {
    console.error("   [FAIL] Mark attendance failed:", markData);
    process.exit(1);
  }

  const recordId = markData.record.id;
  const enrollment = '12024002037046';

  // 2. Toggle student from Present to Absent
  console.log("\n2. Admin toggling student from Present (true) to Absent (false)...");
  const toggleAbsentRes = await makeRequest(`/api/attendance/${recordId}/student/${enrollment}`, 'PATCH', { present: false });
  const toggleAbsentData = await toggleAbsentRes.json();
  if (toggleAbsentData.success) {
    const student = toggleAbsentData.record.students.find(s => s.enrollment === enrollment);
    if (student && student.present === false) {
      console.log("   [PASS] Student status updated to Absent in API response!");
    } else {
      console.error("   [FAIL] Incorrect student status in response:", student);
      process.exit(1);
    }
  } else {
    console.error("   [FAIL] Toggle to Absent failed:", toggleAbsentData);
    process.exit(1);
  }

  // 3. Verify in database
  console.log("\n3. Verifying updated status in database records...");
  const verifyRes = await makeRequest('/api/attendance/all', 'GET');
  const verifyData = await verifyRes.json();
  if (verifyData.success) {
    const record = verifyData.records.find(r => r.id === recordId);
    const student = record ? record.students.find(s => s.enrollment === enrollment) : null;
    if (student && student.present === false) {
      console.log("   [PASS] Verified! Student status is Absent in database.");
    } else {
      console.error("   [FAIL] Student status not updated in database or record not found:", record);
      process.exit(1);
    }
  } else {
    console.error("   [FAIL] Fetch all records failed:", verifyData);
    process.exit(1);
  }

  // 4. Toggle student back to Present
  console.log("\n4. Admin toggling student back to Present (true)...");
  const togglePresentRes = await makeRequest(`/api/attendance/${recordId}/student/${enrollment}`, 'PATCH', { present: true });
  const togglePresentData = await togglePresentRes.json();
  if (togglePresentData.success) {
    const student = togglePresentData.record.students.find(s => s.enrollment === enrollment);
    if (student && student.present === true) {
      console.log("   [PASS] Student status updated back to Present in API response!");
    } else {
      console.error("   [FAIL] Incorrect student status in response:", student);
      process.exit(1);
    }
  } else {
    console.error("   [FAIL] Toggle to Present failed:", togglePresentData);
    process.exit(1);
  }

  // 5. Clean up record
  console.log("\n5. Cleaning up test record...");
  const deleteRes = await makeRequest(`/api/attendance/${recordId}`, 'DELETE');
  const deleteData = await deleteRes.json();
  if (deleteData.success) {
    console.log("   [PASS] Test record deleted successfully!");
  } else {
    console.error("   [FAIL] Failed to delete test record:", deleteData);
  }

  console.log("\n=== ALL ADMIN ATTENDANCE TOGGLE TESTS PASSED! ===");
}

runTests().catch(err => {
  console.error("Error executing tests:", err);
  process.exit(1);
});
