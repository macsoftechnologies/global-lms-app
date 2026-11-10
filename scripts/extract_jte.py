import urllib.request
import re
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = "https://launchpaad.tech/macslearnfrontend/assets/index-B-vMsWQS.js"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req, context=ctx, timeout=15) as res:
    code = res.read().decode('utf-8', errors='ignore')

idx = code.find('function Jte(')
if idx != -1:
    print("Found Jte at", idx)
    print(code[idx:idx+2500])

