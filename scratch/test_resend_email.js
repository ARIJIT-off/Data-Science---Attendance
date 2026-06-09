const http = require('http');

const postData = JSON.stringify({
  email: 'noreply.uemk.attendance@gmail.com',
  role: 'Teacher'
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/send-otp',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('BODY:', data);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(postData);
req.end();
