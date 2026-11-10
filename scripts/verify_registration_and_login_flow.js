const https = require('https');

const BASE_URL = 'https://launchpaad.tech/macslearnbackend/api/v1';

function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(url, {
      method,
      headers: {
        ...(data ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        } : {}),
      },
    }, (res) => {
      let resp = '';
      res.on('data', chunk => resp += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resp) });
        } catch {
          resolve({ status: res.statusCode, data: resp });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function verifyFlow() {
  console.log('========================================================================');
  console.log('VERIFYING REGISTRATION & LOGIN INTEGRATION FLOW AGAINST LIVE BACKEND');
  console.log('Base URL:', BASE_URL);
  console.log('========================================================================\n');

  // STEP 1: Organization Code Retrieval
  console.log('1. Testing Organization Code Retrieval (Item 14.6: GET /public/organizations/org1)...');
  const orgRes = await request('/public/organizations/org1');
  console.log('   Status:', orgRes.status);
  console.log('   Organization Name:', orgRes.data?.data?.name);
  console.log('   Organization Code (slug):', orgRes.data?.data?.slug);
  console.log('   Logo URL:', orgRes.data?.data?.logoUrl);
  if (orgRes.status === 200 && orgRes.data?.data?.slug === 'org1') {
    console.log('   -> PASS: Organization Code resolved accurately from backend.\n');
  } else {
    throw new Error('FAIL: Organization code retrieval failed');
  }

  // STEP 2: Regions Retrieval
  console.log('2. Testing Regions Retrieval (Item 14.1: GET /regions?slug=org1&localOnly=true)...');
  const regRes = await request('/regions?slug=org1&localOnly=true');
  console.log('   Status:', regRes.status);
  console.log('   Regions Count:', regRes.data?.data?.length);
  const regionId = regRes.data?.data?.[0]?.id;
  console.log('   Selected Region ID:', regionId);
  if (regRes.status === 200 && regionId) {
    console.log('   -> PASS: Regions retrieved successfully.\n');
  } else {
    throw new Error('FAIL: Regions retrieval failed');
  }

  // STEP 3: Programs Retrieval
  console.log('3. Testing Programs Retrieval (Item 14.2: GET /programs/public?limit=100&slug=org1)...');
  const progRes = await request('/programs/public?limit=100&slug=org1');
  console.log('   Status:', progRes.status);
  console.log('   Programs Count:', progRes.data?.data?.length);
  const programId = progRes.data?.data?.[0]?.id;
  console.log('   Selected Program ID:', programId);
  if (progRes.status === 200 && programId) {
    console.log('   -> PASS: Programs retrieved successfully.\n');
  } else {
    throw new Error('FAIL: Programs retrieval failed');
  }

  // STEP 4: Registration API
  console.log('4. Testing Student Registration (Item 1.1: POST /auth/register)...');
  const testStudentEmail = `student.test.${Date.now()}@example.com`;
  const regPayload = {
    fullName: 'Jushal Kumar',
    email: testStudentEmail,
    password: 'SecurePassword123!',
    mobile: '+919876543210',
    organizationCode: 'org1',
    regionId: regionId,
    ataStatus: 'ATA',
    customProfile: {
      ataStatus: 'ATA',
      countryOfCitizenship: 'India',
      countryLivingIn: 'India',
      gender: 'Male',
      dateOfBirth: '1998-05-15',
      maritalStatus: 'Single',
      motherTongue: 'English',
      address: 'Grace Seminary Campus',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500001',
      highestEducation: 'Bachelor of Science (B.Sc)',
      interestedCourse: programId,
      declarationAccepted: true,
    },
  };
  const regResult = await request('/auth/register', 'POST', regPayload);
  console.log('   Status:', regResult.status);
  console.log('   Response Message:', regResult.data?.data?.message || regResult.data?.message);
  if (regResult.status === 201) {
    console.log('   -> PASS: Student Registration accepted by live backend!\n');
  } else {
    console.log('   Response:', regResult.data);
    throw new Error('FAIL: Registration request was rejected');
  }

  // STEP 5: Login with freshly registered account (Pending Review)
  console.log('5. Testing Login with Registered Account (Item 1.2: POST /auth/login)...');
  const loginRes = await request('/auth/login', 'POST', {
    email: testStudentEmail,
    password: 'SecurePassword123!',
    organizationCode: 'org1',
  });
  console.log('   Status:', loginRes.status);
  console.log('   Response Body:', JSON.stringify(loginRes.data));
  if (loginRes.status === 401 && (loginRes.data?.message?.[0] === 'Account is PENDING' || loginRes.data?.message === 'Account is PENDING')) {
    console.log('   -> PASS: Backend correctly recognized registered student as PENDING review!\n');
  } else {
    throw new Error('FAIL: Unexpected login response for pending student');
  }

  // STEP 6: Login with Invalid Organization Code
  console.log('6. Testing Login with Invalid Organization Code (POST /auth/login)...');
  const invalidOrgLogin = await request('/auth/login', 'POST', {
    email: testStudentEmail,
    password: 'SecurePassword123!',
    organizationCode: 'invalid_org_code_xyz',
  });
  console.log('   Status:', invalidOrgLogin.status);
  console.log('   Response Message:', invalidOrgLogin.data?.message);
  if (invalidOrgLogin.status === 401 && invalidOrgLogin.data?.message?.[0]?.includes('Invalid organization code')) {
    console.log('   -> PASS: Backend correctly rejected invalid organization code.\n');
  } else {
    throw new Error('FAIL: Backend did not reject invalid organization code');
  }

  console.log('========================================================================');
  console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY (6/6)');
  console.log('========================================================================');
}

verifyFlow().catch((err) => {
  console.error('\nVerification Error:', err);
  process.exit(1);
});

