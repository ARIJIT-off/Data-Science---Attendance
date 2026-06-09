const http = require('http');

function createSession(subject, year, section) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      teacherEmail: 'ap2446961@gmail.com',
      teacherName: 'Arijit Pal',
      subject: subject,
      year: year,
      section: section,
      date: '2026-06-08'
    });

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/session/create',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve(JSON.parse(data));
      });
    });

    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

async function run() {
  try {
    const s1 = await createSession('Maths', '1st Year', 'Sec A');
    console.log('Session 1:', s1);
    const s2 = await createSession('Maths', '1st Year', 'Sec A');
    console.log('Session 2:', s2);
    const s3 = await createSession('Physics', '2nd Year', 'Sec B');
    console.log('Session 3:', s3);
  } catch (e) {
    console.error(e);
  }
}

run();
