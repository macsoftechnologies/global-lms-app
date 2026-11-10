const fs = require('fs');

const path = 'c:/Users/dell/.gemini/antigravity/brain/f2067df2-0cb1-4fc3-8e18-8ce99456b36e/.user_uploaded/media_1794203346272_d9cc533d.json';
const postman = JSON.parse(fs.readFileSync(path, 'utf8'));

function findRequests(items, list = []) {
  for (const item of items) {
    if (item.request) list.push(item);
    if (item.item) findRequests(item.item, list);
  }
  return list;
}

const all = findRequests(postman.item || []);
console.log('Total Postman requests:', all.length);

const paymentRelated = all.filter(r => {
  const url = String(r.request.url?.raw || r.request.url || '');
  const name = r.name.toLowerCase();
  return (
    url.includes('payment') ||
    url.includes('enroll') ||
    url.includes('checkout') ||
    url.includes('order') ||
    url.includes('fee') ||
    name.includes('payment') ||
    name.includes('enroll') ||
    name.includes('buy')
  );
});

console.log('\n--- Relevant Postman Endpoints ---');
for (const r of paymentRelated) {
  console.log(`[${r.request.method}] ${r.name}`);
  console.log(`  URL: ${r.request.url?.raw || r.request.url}`);
  if (r.request.body?.raw) {
    console.log(`  Body: ${r.request.body.raw}`);
  }
}

