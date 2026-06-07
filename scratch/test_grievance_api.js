const http = require('http');

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString)
      }
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: JSON.parse(responseBody)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: responseBody
          });
        }
      });
    });

    req.on('error', (err) => { reject(err); });
    if (body) req.write(dataString);
    req.end();
  });
}

async function runTests() {
  console.log('--- Testing Student Grievance Endpoints ---');

  // Test 1: Submit a grievance
  console.log('\nTest 1: Submit grievance...');
  const grievancePayload = {
    studentName: 'Test Student',
    studentRoll: '99',
    studentEnrollment: '120249999999',
    message: 'Sir marked me absent in Artificial Intelligence on 5th Jun, please adjust.'
  };

  const postRes = await request('POST', '/api/grievance', grievancePayload);
  if (postRes.statusCode === 200 && postRes.body.success) {
    console.log('[PASS] Grievance submitted successfully!');
    console.log('Returned Grievance ID:', postRes.body.grievance.id);
  } else {
    console.error('[FAIL] Grievance submission failed:', postRes.statusCode, postRes.body);
    process.exit(1);
  }

  const targetId = postRes.body.grievance.id;

  // Test 2: Fetch all grievances
  console.log('\nTest 2: Fetching grievances...');
  const getRes = await request('GET', '/api/grievances');
  if (getRes.statusCode === 200 && getRes.body.success) {
    const grievancesList = getRes.body.grievances;
    const found = grievancesList.find(g => g.id === targetId);
    if (found && found.message === grievancePayload.message) {
      console.log('[PASS] Found our test grievance in the retrieved list!');
    } else {
      console.error('[FAIL] Test grievance not found in list.');
      process.exit(1);
    }
  } else {
    console.error('[FAIL] Grievances fetch failed:', getRes.statusCode, getRes.body);
    process.exit(1);
  }

  // Test 3: Delete grievance
  console.log('\nTest 3: Deleting grievance...');
  const deleteRes = await request('DELETE', `/api/grievance/${targetId}`);
  if (deleteRes.statusCode === 200 && deleteRes.body.success) {
    console.log('[PASS] Grievance deleted successfully!');
  } else {
    console.error('[FAIL] Grievance deletion failed:', deleteRes.statusCode, deleteRes.body);
    process.exit(1);
  }

  // Test 4: Confirm deleted
  console.log('\nTest 4: Confirming deletion...');
  const confirmRes = await request('GET', '/api/grievances');
  if (confirmRes.statusCode === 200 && confirmRes.body.success) {
    const grievancesList = confirmRes.body.grievances;
    const found = grievancesList.find(g => g.id === targetId);
    if (!found) {
      console.log('[PASS] Verified: test grievance is no longer in grievances list!');
    } else {
      console.error('[FAIL] Grievance still exists after deletion!');
      process.exit(1);
    }
  } else {
    console.error('[FAIL] Grievances confirm fetch failed:', confirmRes.statusCode, confirmRes.body);
    process.exit(1);
  }

  console.log('\n[SUCCESS] All grievance integration tests passed successfully!');
}

runTests().catch(err => {
  console.error('[ERROR] Unexpected test exception:', err);
  process.exit(1);
});
