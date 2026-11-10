import re

with open("scripts/extracted_discussion.txt", "r", encoding="utf-8") as f:
    text = f.read()

# Also let's search index-B-vMsWQS.js directly for g9 definition
import urllib.request
import ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request("https://launchpaad.tech/macslearnfrontend/assets/index-B-vMsWQS.js", headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req, context=ctx, timeout=15) as res:
    js = res.read().decode('utf-8', errors='ignore')

# Find g9 definition: var g9=... or function g9... or g9=()=>{
matches = [m.start() for m in re.finditer(r'var g9=function|function g9\(|var g9=\(|const g9=|let g9=|g9=\(\)=>|g9=function\(', js)]
print("g9 matches:", len(matches))
if not matches:
    matches = [m.start() for m in re.finditer(r'g9=', js)]
    print("g9= matches:", len(matches))

for idx in matches[:5]:
    print("\n--- MATCH AT", idx, "---")
    print(js[max(0, idx - 50): min(len(js), idx + 2500)])

