const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
  });
}

async function main() {
  const js = await fetchUrl('https://launchpaad.tech/macslearnfrontend/assets/index-B-vMsWQS.js');
  console.log('Searching for program screen code in JS bundle...');

  const searchTerms = [
    'Academic Curriculum',
    'Term Subjects',
    'my-program-courses',
    'cyclic-status',
    'programs/',
    'Active Term',
    'enrolled in all subjects',
  ];

  for (const term of searchTerms) {
    const idx = js.indexOf(term);
    if (idx !== -1) {
      console.log(`\n=== Found "${term}" at index ${idx} ===`);
      console.log(js.slice(Math.max(0, idx - 200), Math.min(js.length, idx + 400)));
    } else {
      console.log(`Term "${term}" not found.`);
    }
  }
}

main();

