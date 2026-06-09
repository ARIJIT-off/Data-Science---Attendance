const http = require('http');

function testUrl(url, label) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`=== ${label} ===`);
        console.log('STATUS:', res.statusCode);
        console.log('CACHE-CONTROL:', res.headers['cache-control']);
        console.log('BODY:', data);
        resolve();
      });
    }).on('error', (err) => {
      console.error(`Error (${label}):`, err.message);
      resolve();
    });
  });
}

async function run() {
  // Wait a bit for server to be fully ready
  await new Promise(r => setTimeout(r, 1000));
  
  await testUrl('http://localhost:3000/api/session/vZp7uAmuwGvOPV75KMe2tWO7?enrollment=12024002037058', 'Marked Student');
  await testUrl('http://localhost:3000/api/session/vZp7uAmuwGvOPV75KMe2tWO7?enrollment=12024002037046', 'Unmarked Student');
  await testUrl('http://localhost:3000/api/session/vZp7uAmuwGvOPV75KMe2tWO7', 'No Enrollment');
  await testUrl('http://localhost:3000/api/session/vZp7uAmuwGvOPV75KMe2tWO7/poll', 'Poll API');
}

run();
