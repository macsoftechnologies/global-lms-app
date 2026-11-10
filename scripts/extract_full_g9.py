import urllib.request
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request("https://launchpaad.tech/macslearnfrontend/assets/index-B-vMsWQS.js", headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req, context=ctx, timeout=15) as res:
    js = res.read().decode('utf-8', errors='ignore')

idx = 1485366
snippet = js[idx: idx + 8000]

with open("scripts/full_website_g9_chat.js", "w", encoding="utf-8") as out:
    out.write(snippet)

print("Saved 8000 chars of g9 function to scripts/full_website_g9_chat.js")

