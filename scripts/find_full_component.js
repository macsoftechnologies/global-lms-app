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
  const targetIndex = js.indexOf('Academic Curriculum & Term Subjects');
  console.log('Target index:', targetIndex);

  // Let's go backwards to find `function `
  const beforeSlice = js.slice(Math.max(0, targetIndex - 12000), targetIndex);
  
  // Find all function declarations in beforeSlice
  const funcIndices = [];
  let pos = 0;
  while ((pos = beforeSlice.indexOf('function ', pos)) !== -1) {
    funcIndices.push(pos);
    pos += 9;
  }
  console.log('Functions found before target:', funcIndices.length);
  const lastFuncPos = funcIndices[funcIndices.length - 1];
  console.log('Last function pos before target:', lastFuncPos);

  const componentCode = beforeSlice.slice(lastFuncPos) + js.slice(targetIndex, targetIndex + 2000);
  console.log('\nComponent start:\n', componentCode.slice(0, 3500));
}

main();

