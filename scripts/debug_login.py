import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

base = "https://launchpaad.tech/macslearnbackend/api/v1"

def try_login(payload):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(f"{base}/auth/login", data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=8) as res:
            return res.status, json.loads(res.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        raw = e.read().decode('utf-8')
        try:
            return e.code, json.loads(raw)
        except:
            return e.code, raw

print("1:", try_login({"email": "vasupallivarsha@gmail.com", "password": "password123", "organizationCode": "org1"}))
print("2:", try_login({"email": "vasupallivarsha@gmail.com", "password": "SecurePassword123!", "organizationCode": "org1"}))
print("3:", try_login({"email": "admin@global.lms", "password": "password123", "organizationCode": "org1"}))
print("4:", try_login({"email": "admin@launchpaad.tech", "password": "password123", "organizationCode": "org1"}))

