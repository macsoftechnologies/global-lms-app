const https = require('https');

const HOST = 'launchpaad.tech';
const BASE_PATH = '/macslearnbackend/api/v1';

function postJson(path, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname: HOST,
      port: 443,
      path: `${BASE_PATH}${path}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('EXECUTION OF ACTUAL STUDENT & FACULTY AUTHENTICATION');
  console.log(`TARGET: https://${HOST}${BASE_PATH}`);
  console.log('====================================================\n');

  // Test 1: Student Login (Payload validation)
  console.log('[TEST 1] Student Login API - Credential Validation');
  const stuPayload = {
    email: 'student.applicant@example.com',
    password: 'SecurePassword123!',
    organizationCode: 'org1',
  };
  console.log(`Request URL: POST https://${HOST}${BASE_PATH}/auth/login`);
  console.log('Request Payload:', JSON.stringify(stuPayload));
  const stuRes = await postJson('/auth/login', stuPayload);
  console.log('HTTP Status Code:', stuRes.status);
  console.log('Response Body:', JSON.stringify(stuRes.body, null, 2));
  console.log('----------------------------------------------------\n');

  // Test 2: Faculty Login (Payload validation)
  console.log('[TEST 2] Faculty Login API - Credential Validation');
  const facPayload = {
    email: 'faculty@organization.com',
    password: 'SecurePassword123!',
    organizationCode: 'org1',
  };
  console.log(`Request URL: POST https://${HOST}${BASE_PATH}/auth/login`);
  console.log('Request Payload:', JSON.stringify(facPayload));
  const facRes = await postJson('/auth/login', facPayload);
  console.log('HTTP Status Code:', facRes.status);
  console.log('Response Body:', JSON.stringify(facRes.body, null, 2));
  console.log('----------------------------------------------------\n');

  // Test 3: Missing Required Fields
  console.log('[TEST 3] Login API - Missing Required Fields (Validation Error)');
  const missingPayload = {
    email: 'student.applicant@example.com',
    // Missing password
    organizationCode: 'org1',
  };
  console.log(`Request URL: POST https://${HOST}${BASE_PATH}/auth/login`);
  console.log('Request Payload:', JSON.stringify(missingPayload));
  const missingRes = await postJson('/auth/login', missingPayload);
  console.log('HTTP Status Code:', missingRes.status);
  console.log('Response Body:', JSON.stringify(missingRes.body, null, 2));
  console.log('Test 3 Result:', missingRes.status >= 400 ? 'VALIDATION REJECTED (Expected)' : 'UNEXPECTED');
  console.log('====================================================\n');
}

runTests().catch(console.error);
