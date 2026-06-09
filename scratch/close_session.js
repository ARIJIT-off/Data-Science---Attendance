const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/session/kDGZMP7OHhZQqAFCzZmtqbht/close',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
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

req.write('{}');
req.end();
