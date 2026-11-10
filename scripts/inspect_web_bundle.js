const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
    }).on('error', (err) => resolve({ error: err.message }));
  });
}

async function main() {
  const url = 'https://launchpaad.tech/macslearnfrontend/student/programs/c1c09866-b2cf-4d90-bb64-cd6c0515165b';
  console.log('Fetching', url);
  const r = await fetchUrl(url);
  console.log('Status:', r.status);
  console.log('Data slice:', r.data?.slice(0, 500));
  const jsMatches = r.data?.match(/\/macslearnfrontend\/static\/js\/[^"']+\.js/g) || r.data?.match(/static\/js\/[^"']+\.js/g) || r.data?.match(/src="([^"]+\.js)"/g);
  console.log('Matches:', jsMatches);

  if (jsMatches) {
    for (const match of jsMatches.slice(0, 3)) {
      const cleanPath = match.replace('src="', '').replace('"', '');
      const fullJsUrl = cleanPath.startsWith('http') ? cleanPath : `https://launchpaad.tech${cleanPath.startsWith('/') ? '' : '/'}${cleanPath}`;
      console.log('\nFetching JS bundle:', fullJsUrl);
      const jsRes = await fetchUrl(fullJsUrl);
      console.log('JS length:', jsRes.data?.length);

      // Search for program endpoints in the bundle!
      const regexes = [
        /enrollments\/my-program-courses[^\s"']*/g,
        /programs\/[a-zA-Z0-9_\-\$]+/g,
        /semesters[^\s"']*/g,
        /api\/v1\/[a-zA-Z0-9_\-\/]+/g,
      ];
      for (const re of regexes) {
        const found = jsRes.data?.match(re);
        if (found) {
          const unique = [...new Set(found)];
          console.log(`Found with ${re}:`, unique.slice(0, 10));
        }
      }
    }
  }
}

main();

