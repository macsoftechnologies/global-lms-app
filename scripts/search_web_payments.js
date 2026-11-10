const https = require('https');

https.get('https://launchpaad.tech/macslearnfrontend/assets/index-B-vMsWQS.js', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Bundle loaded, length:', data.length);

    // Search for payment endpoints
    const regexes = [
      /\/payments\/[a-zA-Z0-9_\-\/]+/g,
      /\/enrollments\/[a-zA-Z0-9_\-\/]+/g,
      /razorpay/gi,
      /stripe/gi,
      /order/gi,
      /buy course/gi,
      /checkout/gi,
    ];

    for (const r of regexes) {
      const matches = [...data.matchAll(r)];
      console.log(`Regex ${r}: ${matches.length} matches`);
      const unique = [...new Set(matches.map(m => m[0]))];
      console.log('  Unique samples:', unique.slice(0, 10));
    }

    // Search for POST requests to payments
    const postPayments = [...data.matchAll(/W\.post\([`'"]\/payments[^\)]*\)/g)];
    console.log('\nW.post to /payments matches:', postPayments.length);
    for (const m of postPayments) {
      console.log('  ', m[0]);
    }

    // Search for POST requests to enrollments
    const postEnrollments = [...data.matchAll(/W\.post\([`'"]\/enrollments[^\)]*\)/g)];
    console.log('\nW.post to /enrollments matches:', postEnrollments.length);
    for (const m of postEnrollments) {
      console.log('  ', m[0]);
    }
  });
});

