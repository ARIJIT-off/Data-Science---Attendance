const http = require('http');

http.get('http://localhost:3000/api/session/vZp7uAmuwGvOPV75KMe2tWO7', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('BODY:', data);
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
