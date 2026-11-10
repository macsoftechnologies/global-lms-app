const https = require('https');

function probe(urlStr, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const url = new URL(urlStr);
    const postData = body ? JSON.stringify(body) : null;
    const req = https.request(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(postData ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        } : {}),
      },
      timeout: 5000,
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        resolve({ url: urlStr, method, status: res.statusCode, body: raw.slice(0, 200) });
      });
    });
    req.on('error', (e) => resolve({ url: urlStr, method, error: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ url: urlStr, method, error: 'timeout' });
    });
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  const urls = [
    ['https://launchpaad.tech/macslearnbackend/api/v1/discussion/inbox', 'GET'],
    ['https://launchpaad.tech/macslearnbackend/api/v1/discussion/contacts', 'GET'],
    ['https://launchpaad.tech/macslearnbackend/api/v1/tickets/user-list', 'POST', { userId: '123' }],
    ['https://api.raoslawacademy.com/tickets/user-list', 'POST', { userId: '4237c5bb-30d1-495a-96f8-d70ba48ec110' }],
    ['https://api.raoslawacademy.com/tickets/details', 'POST', { ticketId: 'test', userId: 'test' }],
    ['https://api.raoslawacademy.com/users', 'GET'],
    ['https://api.raoslawacademy.com/admin', 'GET'],
    ['https://api.raoslawacademy.com/notifications/list', 'POST', { userId: '4237c5bb-30d1-495a-96f8-d70ba48ec110' }],
  ];

  for (const [u, m, b] of urls) {
    const res = await probe(u, m, b);
    console.log(`${res.method} ${res.url} -> ${res.status || res.error} | ${res.body || ''}`);
  }
}

main();

