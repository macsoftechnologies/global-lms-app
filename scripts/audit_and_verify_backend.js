const https = require('https');

const BASE_URL = 'https://launchpaad.tech/macslearnbackend/api/v1';

function request(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const postData = body ? JSON.stringify(body) : null;
    
    const headers = {
      Accept: 'application/json',
      ...(postData ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      } : {}),
      ...(options.headers || {}),
    };

    const req = https.request(url, {
      method: options.method || (postData ? 'POST' : 'GET'),
      headers,
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(raw);
        } catch {
          json = raw;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json,
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runAudit() {
  console.log('================================================================');
  console.log('GLOBAL LMS - BACKEND AUDIT & VERIFICATION REPORT');
  console.log('Target API Base URL:', BASE_URL);
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================\n');

  // 1. Organization & Public Endpoints
  console.log('--- 1. Verification of Public Organization (org1) ---');
  const orgRes = await request('/public/organizations/org1');
  console.log('Status:', orgRes.status);
  console.log('Organization Name:', orgRes.body?.data?.name);
  console.log('Organization Slug:', orgRes.body?.data?.slug);
  console.log('Organization ID:', orgRes.body?.data?.id);

  // 2. Student Login Tests
  console.log('\n--- 2. Student Login Flow ---');
  
  // Test 2A: Student Login with credentials from Postman collection
  console.log('[2A] Testing Student Login (student.applicant@example.com):');
  const stuLogin1 = await request('/auth/login', { method: 'POST' }, {
    email: 'student.applicant@example.com',
    password: 'SecurePassword123!',
    organizationCode: 'org1',
  });
  console.log('  Status:', stuLogin1.status);
  console.log('  Response:', JSON.stringify(stuLogin1.body));

  // Test 2B: Student Login with reference email (vasupallivarsha@gmail.com)
  console.log('\n[2B] Testing Student Login (vasupallivarsha@gmail.com):');
  const stuLogin2 = await request('/auth/login', { method: 'POST' }, {
    email: 'vasupallivarsha@gmail.com',
    password: 'password123',
    organizationCode: 'org1',
  });
  console.log('  Status:', stuLogin2.status);
  console.log('  Response:', JSON.stringify(stuLogin2.body));

  // Test 2C: Register a fresh student and attempt login to inspect response
  console.log('\n[2C] Registering a new Student to test lifecycle login:');
  const tempEmail = `audit.student.${Date.now()}@cotr.edu`;
  const regRes = await request('/auth/register', { method: 'POST' }, {
    fullName: 'Audit Student',
    email: tempEmail,
    password: 'SecurePassword123!',
    mobile: '+919988776655',
    organizationCode: 'org1',
    regionId: 'd1f2c9a6-a193-4f48-a9c4-acc4cabc9350', // India region
    ataStatus: 'ATA',
    customProfile: {
      ataStatus: 'ATA',
      gender: 'Male',
      countryOfCitizenship: 'India',
      countryLivingIn: 'India',
      declarationAccepted: true,
    },
  });
  console.log('  Registration Status:', regRes.status);
  console.log('  Registration Message:', JSON.stringify(regRes.body));

  const stuLogin3 = await request('/auth/login', { method: 'POST' }, {
    email: tempEmail,
    password: 'SecurePassword123!',
    organizationCode: 'org1',
  });
  console.log('  Fresh Account Login Status:', stuLogin3.status);
  console.log('  Fresh Account Login Message:', JSON.stringify(stuLogin3.body));

  // 3. Faculty Login Tests
  console.log('\n--- 3. Faculty Login Flow ---');
  console.log('[3A] Testing Faculty Login (faculty@organization.com):');
  const facLogin1 = await request('/auth/login', { method: 'POST' }, {
    email: 'faculty@organization.com',
    password: 'SecurePassword123!',
    organizationCode: 'org1',
  });
  console.log('  Status:', facLogin1.status);
  console.log('  Response:', JSON.stringify(facLogin1.body));

  // 4. Browse Published Courses & 401 Inspection
  console.log('\n--- 4. Browse Published Courses Inspection (/courses) ---');
  
  // Test 4A: Without token
  console.log('[4A] GET /courses?page=1&limit=20&status=PUBLISHED (No Authorization header):');
  const noTokenCourses = await request('/courses?page=1&limit=20&status=PUBLISHED');
  console.log('  Status:', noTokenCourses.status);
  console.log('  Headers:', JSON.stringify({
    'www-authenticate': noTokenCourses.headers['www-authenticate'],
    'content-type': noTokenCourses.headers['content-type'],
  }));
  console.log('  Response Body:', JSON.stringify(noTokenCourses.body));

  // Test 4B: With malformed/expired Bearer token
  console.log('\n[4B] GET /courses (With dummy/expired Bearer token):');
  const badTokenCourses = await request('/courses?page=1&limit=20&status=PUBLISHED', {
    headers: {
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummyPayload.signature',
    },
  });
  console.log('  Status:', badTokenCourses.status);
  console.log('  Response Body:', JSON.stringify(badTokenCourses.body));

  // 5. Get Course Details by ID Inspection
  console.log('\n--- 5. Get Course Details by ID (/courses/:id) ---');
  const testCourseId = 'sample-course-id-123';
  const courseDetailsRes = await request(`/courses/${testCourseId}`);
  console.log('  Status (No Token):', courseDetailsRes.status);
  console.log('  Response Body:', JSON.stringify(courseDetailsRes.body));

  // 6. Token Refresh Inspection
  console.log('\n--- 6. Token Refresh Inspection (/auth/refresh-token) ---');
  const refreshMissing = await request('/auth/refresh-token', { method: 'POST' }, {});
  console.log('  Status (Missing Body):', refreshMissing.status);
  console.log('  Response Body:', JSON.stringify(refreshMissing.body));

  const refreshInvalid = await request('/auth/refresh-token', { method: 'POST' }, {
    refreshToken: 'sample_refresh_token_xyz',
  });
  console.log('  Status (Invalid Refresh Token):', refreshInvalid.status);
  console.log('  Response Body:', JSON.stringify(refreshInvalid.body));

  console.log('\n================================================================');
  console.log('AUDIT COMPLETED');
  console.log('================================================================');
}

runAudit().catch(console.error);

