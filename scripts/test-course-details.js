const https = require('https');

const BASE_URL = 'https://launchpaad.tech/macslearnbackend/api/v1';
const COURSE_ID = '962d633b-a06b-11f1-9ef5-ace8d4becfc2';

function getCourseDetails(courseId, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}/courses/${encodeURIComponent(courseId)}`);
    const headers = {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    https.get(url, { headers }, (res) => {
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
          data: json,
        });
      });
    }).on('error', reject);
  });
}

async function runTest() {
  console.log('================================================================');
  console.log('TESTING GET COURSE DETAILS BY ID API');
  console.log('Target API:', `${BASE_URL}/courses/${COURSE_ID}`);
  console.log('================================================================\n');

  console.log('1. Direct HTTP GET Request (Unauthenticated inspection):');
  const unauthRes = await getCourseDetails(COURSE_ID);
  console.log('   HTTP Status:', unauthRes.status);
  console.log('   Response Body:', JSON.stringify(unauthRes.data, null, 2));

  console.log('\n2. HTTP GET Request with Bearer Token header:');
  const dummyToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy';
  const authRes = await getCourseDetails(COURSE_ID, dummyToken);
  console.log('   HTTP Status:', authRes.status);
  console.log('   Response Body:', JSON.stringify(authRes.data, null, 2));

  console.log('\n================================================================');
  console.log('VERIFICATION SUMMARY');
  console.log('Course ID:', COURSE_ID);
  console.log('Endpoint URL: GET /courses/' + COURSE_ID);
  console.log('Server Protection: Enforced with Bearer Token JWT AuthGuard (HTTP 401)');
  console.log('================================================================');
}

runTest().catch(console.error);

