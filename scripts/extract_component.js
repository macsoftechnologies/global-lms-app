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
  const start = 1790000;
  const end = 1803000;
  const slice = js.slice(start, end);
  console.log('Component code length:', slice.length);

  // Search for API calls inside this component
  const apiCalls = slice.match(/[a-zA-Z0-9_]+\([^\)]*\)/g);
  console.log('Sample functions:', apiCalls?.slice(0, 30));

  // Write the whole slice to a file to analyze
  const fs = require('fs');
  fs.writeFileSync('scripts/web_curriculum_component.js', slice);
  console.log('Written to scripts/web_curriculum_component.js');
}

main();

