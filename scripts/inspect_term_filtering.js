const fs = require('fs');

const js = fs.readFileSync('scripts/web_curriculum_component.js', 'utf8');

// Find how P, f, m, h are filtered or rendered
// In bme():
// d = u?.data || u || [] (from tC({ programId: e }) -> /semesters?programId=e)
// f = Array.isArray(d) ? d.filter(t => t.programId === e || !t.programId) : []
// f.sort((e, t) => (parseInt((e.name || e.term || '').replace(/\D/g, '')) || 0) - (parseInt((t.name || t.term || '').replace(/\D/g, '')) || 0))
// ee(f) -> sets the semesters list!
// P is the selected semester ID!
// if (P === 'ALL' || !P) { let e = f.find(e => e.id === n?.semesterId) || f[0]; e && F(e.id); }

console.log('Semesters setup in website:');
console.log('f = semesters list sorted by term number in name/term!');
console.log('P = selected semester ID!');

// Now let's see how courses are filtered by selected semester P:
// h = courses with examsCount (from HS({ programId: e, limit: 100 }))
// Let's find where h is filtered by P!
const pIndices = [];
let pos = 0;
while ((pos = js.indexOf('.semester', pos)) !== -1) {
  console.log(`\nFound .semester at ${pos}:`);
  console.log(js.slice(Math.max(0, pos - 100), Math.min(js.length, pos + 200)));
  pos += 9;
}

const pFilterIndices = [];
pos = 0;
while ((pos = js.indexOf('.filter(', pos)) !== -1) {
  console.log(`\nFound .filter( at ${pos}:`);
  console.log(js.slice(Math.max(0, pos - 50), Math.min(js.length, pos + 150)));
  pos += 8;
}

