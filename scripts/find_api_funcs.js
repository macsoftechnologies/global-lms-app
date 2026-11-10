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
  const funcs = ['Lx=', 'kS=', 'FS=', 'VS=', 'HS=', 'tC=', 'A5='];

  for (const f of funcs) {
    let pos = 0;
    while ((pos = js.indexOf(f, pos)) !== -1) {
      console.log(`\n=== Definition for ${f} at index ${pos} ===`);
      console.log(js.slice(pos, pos + 250));
      pos += f.length;
    }
  }
}

main();

