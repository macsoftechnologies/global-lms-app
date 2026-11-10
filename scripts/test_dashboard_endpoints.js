const https = require('https');

const BASE_URL = 'https://launchpaad.tech/macslearnbackend/api/v1';

function request(path, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const req = https.request(url, { method: 'GET', headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function testEndpoints() {
  console.log('--- Testing Public / Catalog Endpoints ---');
  const coursesRes = await request('/courses?page=1&limit=10&status=PUBLISHED');
  console.log('GET /courses:', coursesRes.status, typeof coursesRes.data);
  if (coursesRes.status === 200) {
    const count = Array.isArray(coursesRes.data) ? coursesRes.data.length : coursesRes.data?.data?.length || 0;
    console.log('Courses count:', count);
  }

  const progRes = await request('/programs/public?limit=10&slug=org1');
  console.log('GET /programs/public:', progRes.status, 'Count:', Array.isArray(progRes.data) ? progRes.data.length : progRes.data?.data?.length);

  const orgRes = await request('/public/organizations/org1');
  console.log('GET /public/organizations/org1:', orgRes.status, orgRes.data?.data?.name || orgRes.data?.name);
}

testEndpoints().catch(console.error);
