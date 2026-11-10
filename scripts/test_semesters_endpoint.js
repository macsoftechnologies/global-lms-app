const https = require('https');

function get(path) {
  return new Promise((resolve) => {
    https.get('https://launchpaad.tech/macslearnbackend/api/v1' + path, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });
  });
}

async function main() {
  const progId = 'c1c09866-b2cf-4d90-bb64-cd6c0515165b';
  console.log('Testing GET /semesters?programId=' + progId);
  const r1 = await get(`/semesters?programId=${progId}`);
  console.log('Status r1:', r1.status, JSON.stringify(r1.body).slice(0, 300));

  console.log('\nTesting GET /courses?programId=' + progId);
  const r2 = await get(`/courses?programId=${progId}&limit=100`);
  console.log('Status r2:', r2.status, JSON.stringify(r2.body).slice(0, 300));

  console.log('\nTesting GET /academic-batches?programId=' + progId);
  const r3 = await get(`/academic-batches?programId=${progId}`);
  console.log('Status r3:', r3.status, JSON.stringify(r3.body).slice(0, 300));
}

main();

