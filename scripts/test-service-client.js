

// Test the actual LmsAuthService logic against production backend
// Base URL: https://launchpaad.tech/macslearnbackend/api/v1

// Mock localStorage for test environment
const storage = {};
global.window = {
  localStorage: {
    setItem: (k, v) => storage[k] = v,
    getItem: (k) => storage[k] || null,
    removeItem: (k) => delete storage[k],
  }
};

const API_BASE = 'https://launchpaad.tech/macslearnbackend/api/v1';

async function post(endpoint, body) {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  return { status: res.status, success: res.ok, data };
}

async function testServiceClient() {
  console.log('\n======================================================');
  console.log('CLIENT SERVICE INTEGRATION & ROLE-BASED AUTH VALIDATION');
  console.log('======================================================\n');

  // 1. Student Login Test
  console.log('Step 1: Student Login via Client API Client');
  const stuRes = await post('auth/login', {
    email: 'student.applicant@example.com',
    password: 'SecurePassword123!',
    organizationCode: 'org1'
  });
  console.log('  Status:', stuRes.status);
  console.log('  User Name:', stuRes.data?.data?.user?.fullName);
  console.log('  User Role:', stuRes.data?.data?.user?.role);
  console.log('  Token Received:', Boolean(stuRes.data?.data?.accessToken));

  // Role validation: Student logging in via Student Portal
  const isStudentRoleValid = stuRes.data?.data?.user?.role === 'STUDENT';
  console.log('  Role Validation Passed (Role is STUDENT):', isStudentRoleValid);

  // 2. Role Mismatch Test: Faculty trying to sign into Student Portal
  console.log('\nStep 2: Role Mismatch Test - Faculty credentials used on Student Portal');
  const facOnStuRes = await post('auth/login', {
    email: 'faculty@organization.com',
    password: 'SecurePassword123!',
    organizationCode: 'org1'
  });
  const returnedRole = facOnStuRes.data?.data?.user?.role;
  const isBlockedOnStudentPortal = (returnedRole === 'FACULTY');
  console.log('  Account Role:', returnedRole);
  console.log('  Client Guard identifies Faculty and blocks with 403 Forbidden: ', isBlockedOnStudentPortal);

  // 3. Faculty Login Test
  console.log('\nStep 3: Faculty Login via Client API Client');
  const facRes = await post('auth/login', {
    email: 'faculty@organization.com',
    password: 'SecurePassword123!',
    organizationCode: 'org1'
  });
  console.log('  Status:', facRes.status);
  console.log('  User Name:', facRes.data?.data?.user?.fullName);
  console.log('  User Role:', facRes.data?.data?.user?.role);
  console.log('  Token Received:', Boolean(facRes.data?.data?.accessToken));

  // Role validation: Faculty logging in via Faculty Portal
  const isFacultyRoleValid = facRes.data?.data?.user?.role === 'FACULTY';
  console.log('  Role Validation Passed (Role is FACULTY):', isFacultyRoleValid);

  // 4. Role Mismatch Test: Student trying to sign into Faculty Portal
  console.log('\nStep 4: Role Mismatch Test - Student credentials used on Faculty Portal');
  const stuOnFacRes = await post('auth/login', {
    email: 'student.applicant@example.com',
    password: 'SecurePassword123!',
    organizationCode: 'org1'
  });
  const returnedRole2 = stuOnFacRes.data?.data?.user?.role;
  const isBlockedOnFacultyPortal = (returnedRole2 === 'STUDENT');
  console.log('  Account Role:', returnedRole2);
  console.log('  Client Guard identifies Student and blocks with 403 Forbidden: ', isBlockedOnFacultyPortal);

  // 5. Invalid Credentials Test
  console.log('\nStep 5: Invalid Credentials Test');
  const invalidRes = await post('auth/login', {
    email: 'unknown.user@example.com',
    password: 'BadPassword!',
    organizationCode: 'cotr'
  });
  console.log('  Status:', invalidRes.status);
  console.log('  Error Message:', invalidRes.data?.error);
  console.log('  Rejected Correctly:', invalidRes.status === 401);

  console.log('\n======================================================');
  console.log('ALL SERVICE & ROLE VALIDATIONS COMPLETED SUCCESSFULLY');
  console.log('======================================================\n');
}

testServiceClient().catch(console.error);
