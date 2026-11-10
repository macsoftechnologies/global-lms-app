import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

base_lms = "https://launchpaad.tech/macslearnbackend/api/v1"

def api_call(endpoint, method="POST", payload=None, token=None):
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(payload).encode('utf-8') if payload else None
    req = urllib.request.Request(f"{base_lms}{endpoint}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=8) as res:
            text = res.read().decode('utf-8')
            return res.status, json.loads(text)
    except urllib.error.HTTPError as e:
        text = e.read().decode('utf-8')
        try:
            return e.code, json.loads(text)
        except:
            return e.code, text

print("--- Registering Student ---")
rand_id = "test_" + str(int(1000000 * 0.123456))
email = f"chat.test.{rand_id}@example.com"
code, reg_res = api_call("/auth/register", "POST", {
    "fullName": "Chat Test Student",
    "email": email,
    "password": "SecurePassword123!",
    "mobile": "+919876543299",
    "organizationCode": "org1",
    "regionId": "d1f2c9a6-a193-4f48-a9c4-acc4cabc9350",
    "ataStatus": "ATA",
    "customProfile": {
        "ataStatus": "ATA",
        "gender": "Male",
        "countryOfCitizenship": "India",
        "countryLivingIn": "India",
        "declarationAccepted": True
    }
})
print("Register code:", code, reg_res)

print("--- Logging in Student ---")
code, log_res = api_call("/auth/login", "POST", {
    "email": email,
    "password": "SecurePassword123!",
    "organizationCode": "org1"
})
print("Login code:", code)
token = None
if isinstance(log_res, dict):
    token = log_res.get('data', {}).get('accessToken') or log_res.get('accessToken')
    print("User:", log_res.get('data', {}).get('user'))
    print("Token:", token[:30] if token else "No token")

if token:
    print("\n--- Testing discussion endpoints with valid token ---")
    for ep in ["/discussion/inbox", "/discussion/direct-thread", "/discussion/threads", "/discussion/topics"]:
        c, r = api_call(ep, "GET", token=token)
        print(f"GET {ep} -> {c}: {str(r)[:100]}")

