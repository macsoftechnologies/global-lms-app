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

# Search for email patterns or test credentials
emails = re.findall(r'[\w\.-]+@[\w\.-]+\.\w+', code)
print("Emails found in web bundle:", set(emails))

# Search for authUserId or default logins
for m in re.finditer(r'authUserId|currentUser|localStorage\.getItem\(["\'](auth|user|token)', code):
    idx = m.start()
    print("Match around storage:", repr(code[max(0, idx-100):min(len(code), idx+150)]))

