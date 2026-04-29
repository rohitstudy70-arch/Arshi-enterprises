const fs = require('fs');
const http = require('http');

// We'll login to get a valid JWT token using default admin credentials
const adminCredentials = { username: 'admin', password: 'admin123' };
let token = null;

const endpoints = [
  { url: '/api/reports/income/pdf', filename: 'income-test.pdf' },
  { url: '/api/reports/income/excel', filename: 'income-test.xlsx' },
  { url: '/api/reports/expense/pdf', filename: 'expense-test.pdf' },
  { url: '/api/reports/expense/excel', filename: 'expense-test.xlsx' }
];

async function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path: endpoint.url,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(options, (res) => {
      console.log(`Testing ${endpoint.url}...`);
      console.log(`Status: ${res.statusCode}`);
      console.log(`Content-Type: ${res.headers['content-type']}`);

      const file = fs.createWriteStream(`d:\\TAILWIND\\${endpoint.filename}`);
      res.pipe(file);

      file.on('finish', () => {
        file.close();
        const stats = fs.statSync(`d:\\TAILWIND\\${endpoint.filename}`);
        console.log(`File size: ${stats.size} bytes\n`);
        resolve();
      });

      file.on('error', (err) => {
        console.error(`File error: ${err.message}\n`);
        resolve();
      });
    });

    req.on('error', (err) => {
      console.error(`Request error: ${err.message}\n`);
      resolve();
    });

    req.end();
  });
}

async function runTests() {
  console.log('Testing Report Endpoints...\n');
  // Login first to obtain token
  await new Promise((resolve) => {
    const data = JSON.stringify(adminCredentials);
    const opts = { hostname: 'localhost', port: 4000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', (c) => (body += c.toString()));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          token = parsed.token || (parsed.data && parsed.data.token) || null;
          console.log('Obtained token:', !!token);
        } catch (e) {
          console.error('Login parse error', e.message);
        }
        resolve();
      });
    });
    req.on('error', (e) => { console.error('Login request error', e.message); resolve(); });
    req.write(data);
    req.end();
  });

  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }

  console.log('Tests completed!');
}

runTests();
