const https = require('https');

https.get('https://launchpaad.tech/macslearnfrontend/assets/index-B-vMsWQS.js', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    // 1. Context around /enrollments/student/courses/
    const enrollMatches = [...data.matchAll(/\/enrollments\/student\/courses\/[^\)]+/g)];
    for (const m of enrollMatches) {
      console.log('\n--- Context around enroll in standalone course (' + m.index + ') ---');
      console.log(data.substring(Math.max(0, m.index - 400), Math.min(data.length, m.index + 800)));
    }

    // 2. Context around "Buy Course"
    const buyMatches = [...data.matchAll(/Buy Course/g)];
    for (const m of buyMatches) {
      console.log('\n--- Context around Buy Course (' + m.index + ') ---');
      console.log(data.substring(Math.max(0, m.index - 400), Math.min(data.length, m.index + 800)));
    }
  });
});

