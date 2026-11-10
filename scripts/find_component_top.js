const fs = require('fs');

const js = fs.readFileSync('scripts/web_curriculum_component.js', 'utf8');

// Look for useEffect or async functions that fetch data
const matches = [];
let re = /useEffect\([^\{]*\{([^\}]+)\}/g;
let m;
while ((m = re.exec(js)) !== null) {
  matches.push(m[0]);
}
console.log('useEffect matches:', matches.length);
matches.forEach((x, i) => console.log(`[${i}]`, x.slice(0, 200)));

// Also look for W.get or api calls
const getCalls = js.match(/W\.get\([^\)]+\)/g) || [];
console.log('\nW.get calls:', getCalls);

// Look for .get( or fetch
const allGets = js.match(/\.get\([^\)]+\)/g) || [];
console.log('\nAll .get calls:', allGets);

// Let's find the function declaration before index 1795000 in the original file
const fullJs = require('fs').readFileSync('scripts/search_web_code.js'); // wait, let's load from node

