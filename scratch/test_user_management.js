const assert = require('assert');

async function testUserManagement() {
  console.log('Starting User Management API tests...');
  const baseUrl = 'http://localhost:3000';

  try {
    // 1. Fetch initial user list
    let res = await fetch(`${baseUrl}/api/admin/users`);
    let json = await res.json();
    assert.ok(json.success, 'Fetch users list success');
    const initialStudentsCount = json.students.length;
    const initialTeachersCount = json.teachers.length;
    const initialAdminsCount = json.admins.length;
    console.log(`Initial status: Students=${initialStudentsCount}, Teachers=${initialTeachersCount}, Admins=${initialAdminsCount}`);

    // 2. Add a student
    res = await fetch(`${baseUrl}/api/admin/users/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'Student',
        data: {
          name: 'TEST STUDENT',
          roll: '999',
          enrollment: '99999999999999'
        }
      })
    });
    json = await res.json();
    assert.ok(json.success, 'Add student success');
    console.log('✓ Successfully added test student');

    // 3. Add a teacher
    res = await fetch(`${baseUrl}/api/admin/users/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'Teacher',
        data: {
          name: 'TEST TEACHER',
          email: 'test_teacher_manage@uem.edu.in',
          mobile: '9876543210'
        }
      })
    });
    json = await res.json();
    assert.ok(json.success, 'Add teacher success');
    console.log('✓ Successfully added test teacher');

    // 4. Add an admin
    res = await fetch(`${baseUrl}/api/admin/users/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'Admin',
        data: {
          name: 'TEST ADMIN',
          email: 'test_admin_manage@uem.edu.in',
          adminRole: 'A.HOD',
          mobile: '9876543211',
          department: 'CSE Data Science'
        }
      })
    });
    json = await res.json();
    assert.ok(json.success, 'Add admin success');
    console.log('✓ Successfully added test admin');

    // 5. Fetch and verify additions
    res = await fetch(`${baseUrl}/api/admin/users`);
    json = await res.json();
    assert.strictEqual(json.students.length, initialStudentsCount + 1, 'Students count increased by 1');
    assert.strictEqual(json.teachers.length, initialTeachersCount + 1, 'Teachers count increased by 1');
    assert.strictEqual(json.admins.length, initialAdminsCount + 1, 'Admins count increased by 1');

    const addedStudent = json.students.find(s => s.enrollment === '99999999999999');
    const addedTeacher = json.teachers.find(t => t.email === 'test_teacher_manage@uem.edu.in');
    const addedAdmin = json.admins.find(a => a.email === 'test_admin_manage@uem.edu.in');

    assert.ok(addedStudent, 'Found added student');
    assert.strictEqual(addedStudent.name, 'TEST STUDENT', 'Student name matches');
    assert.ok(addedTeacher, 'Found added teacher');
    assert.strictEqual(addedTeacher.name, 'TEST TEACHER', 'Teacher name matches');
    assert.ok(addedAdmin, 'Found added admin');
    assert.strictEqual(addedAdmin.name, 'TEST ADMIN', 'Admin name matches');
    assert.strictEqual(addedAdmin.role, 'A.HOD', 'Admin role matches');
    console.log('✓ Verified added users in lists');

    // 6. Test duplicate validation
    res = await fetch(`${baseUrl}/api/admin/users/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'Student',
        data: {
          name: 'DUPLICATE STUDENT',
          roll: '999', // duplicate roll
          enrollment: '99999999999999' // duplicate enrollment
        }
      })
    });
    json = await res.json();
    assert.strictEqual(json.success, false, 'Adding duplicate student should fail');
    console.log('✓ Successfully rejected duplicate user');

    // 7. Test protected admin deletion (Arijit Pal)
    res = await fetch(`${baseUrl}/api/admin/users/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'Admin',
        identifier: 'ap2446961@gmail.com'
      })
    });
    json = await res.json();
    assert.strictEqual(json.success, false, 'Deleting protected admin should fail');
    console.log('✓ Successfully rejected deletion of developer Arijit Pal');

    // 8. Delete added users
    res = await fetch(`${baseUrl}/api/admin/users/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'Student',
        identifier: '99999999999999'
      })
    });
    json = await res.json();
    assert.ok(json.success, 'Delete student success');

    res = await fetch(`${baseUrl}/api/admin/users/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'Teacher',
        identifier: 'test_teacher_manage@uem.edu.in'
      })
    });
    json = await res.json();
    assert.ok(json.success, 'Delete teacher success');

    res = await fetch(`${baseUrl}/api/admin/users/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'Admin',
        identifier: 'test_admin_manage@uem.edu.in'
      })
    });
    json = await res.json();
    assert.ok(json.success, 'Delete admin success');
    console.log('✓ Successfully deleted all test users');

    // 9. Fetch and verify lists returned to original state
    res = await fetch(`${baseUrl}/api/admin/users`);
    json = await res.json();
    assert.strictEqual(json.students.length, initialStudentsCount, 'Students count returned to initial');
    assert.strictEqual(json.teachers.length, initialTeachersCount, 'Teachers count returned to initial');
    assert.strictEqual(json.admins.length, initialAdminsCount, 'Admins count returned to initial');
    console.log('✓ Verified roster clean up completed successfully');
    console.log('\nALL USER MANAGEMENT TESTS PASSED! ✓✓✓');

  } catch (err) {
    console.error('Test execution failed:');
    console.error(err);
    process.exit(1);
  }
}

testUserManagement();
