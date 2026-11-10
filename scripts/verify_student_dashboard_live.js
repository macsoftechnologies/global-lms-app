const https = require('https');

const BASE_URL = 'https://launchpaad.tech/macslearnbackend/api/v1';

function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(parsed, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function verifyStudentDashboardApis() {
  console.log('===================================================================');
  console.log('STUDENT DASHBOARD BACKEND API VERIFICATION');
  console.log('Target Server:', BASE_URL);
  console.log('===================================================================\n');

  const tests = [];

  // 1. GET /programs/public?limit=100&slug=org1
  try {
    const res = await request(`${BASE_URL}/programs/public?limit=100&slug=org1`, { method: 'GET' });
    const count = Array.isArray(res.data) ? res.data.length : res.data?.data?.length || 0;
    tests.push({
      api: 'GET /programs/public',
      status: res.status === 200 ? 'PASSED' : 'FAILED',
      httpCode: res.status,
      details: `Returned ${count} degree programs available for seminary enrollment.`,
    });
  } catch (err) {
    tests.push({ api: 'GET /programs/public', status: 'FAILED', details: err.message });
  }

  // 2. GET /regions?slug=org1&localOnly=true
  try {
    const res = await request(`${BASE_URL}/regions?slug=org1&localOnly=true`, { method: 'GET' });
    const count = Array.isArray(res.data) ? res.data.length : res.data?.data?.length || 0;
    tests.push({
      api: 'GET /regions',
      status: res.status === 200 ? 'PASSED' : 'FAILED',
      httpCode: res.status,
      details: `Returned ${count} campus regions for student registration.`,
    });
  } catch (err) {
    tests.push({ api: 'GET /regions', status: 'FAILED', details: err.message });
  }

  // 3. GET /notifications/unread-count (Unauthenticated probe -> 401 Protected)
  try {
    const res = await request(`${BASE_URL}/notifications/unread-count`, { method: 'GET' });
    tests.push({
      api: 'GET /notifications/unread-count',
      status: res.status === 401 ? 'PASSED' : 'FAILED',
      httpCode: res.status,
      details: 'Endpoint exists and correctly enforces Bearer token authentication (HTTP 401).',
    });
  } catch (err) {
    tests.push({ api: 'GET /notifications/unread-count', status: 'FAILED', details: err.message });
  }

  // 4. GET /live-sessions/student/upcoming (Unauthenticated probe -> 401 Protected)
  try {
    const res = await request(`${BASE_URL}/live-sessions/student/upcoming`, { method: 'GET' });
    tests.push({
      api: 'GET /live-sessions/student/upcoming',
      status: res.status === 401 ? 'PASSED' : 'FAILED',
      httpCode: res.status,
      details: 'Endpoint exists and correctly enforces Student Bearer token (HTTP 401).',
    });
  } catch (err) {
    tests.push({ api: 'GET /live-sessions/student/upcoming', status: 'FAILED', details: err.message });
  }

  // 5. GET /results/student (Unauthenticated probe -> 401 Protected)
  try {
    const res = await request(`${BASE_URL}/results/student`, { method: 'GET' });
    tests.push({
      api: 'GET /results/student',
      status: res.status === 401 ? 'PASSED' : 'FAILED',
      httpCode: res.status,
      details: 'Endpoint exists and correctly enforces Student Bearer token (HTTP 401).',
    });
  } catch (err) {
    tests.push({ api: 'GET /results/student', status: 'FAILED', details: err.message });
  }

  // 6. GET /certificates/my-certificates (Unauthenticated probe -> 401 Protected)
  try {
    const res = await request(`${BASE_URL}/certificates/my-certificates`, { method: 'GET' });
    tests.push({
      api: 'GET /certificates/my-certificates',
      status: res.status === 401 ? 'PASSED' : 'FAILED',
      httpCode: res.status,
      details: 'Endpoint exists and correctly enforces Student Bearer token (HTTP 401).',
    });
  } catch (err) {
    tests.push({ api: 'GET /certificates/my-certificates', status: 'FAILED', details: err.message });
  }

  // 7. GET /payments/my-payments (Unauthenticated probe -> 401 Protected)
  try {
    const res = await request(`${BASE_URL}/payments/my-payments`, { method: 'GET' });
    tests.push({
      api: 'GET /payments/my-payments',
      status: res.status === 401 ? 'PASSED' : 'FAILED',
      httpCode: res.status,
      details: 'Endpoint exists and correctly enforces Student Bearer token (HTTP 401).',
    });
  } catch (err) {
    tests.push({ api: 'GET /payments/my-payments', status: 'FAILED', details: err.message });
  }

  // 8. POST /auth/refresh-token validation
  try {
    const res = await request(`${BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { refreshToken: 'invalid_probe_token' });
    tests.push({
      api: 'POST /auth/refresh-token',
      status: (res.status === 401 || res.status === 400) ? 'PASSED' : 'FAILED',
      httpCode: res.status,
      details: `Endpoint active, validated invalid refresh token with HTTP ${res.status}.`,
    });
  } catch (err) {
    tests.push({ api: 'POST /auth/refresh-token', status: 'FAILED', details: err.message });
  }

  console.log('RESULTS:');
  tests.forEach((t) => {
    console.log(`[${t.status}] ${t.api} (${t.httpCode || 'ERR'}) -> ${t.details}`);
  });
}

verifyStudentDashboardApis();
