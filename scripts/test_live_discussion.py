import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

BASE_URL = "https://launchpaad.tech/macslearnbackend/api/v1"

def req(path, method="GET", payload=None, token=None):
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(payload).encode('utf-8') if payload else None
    request = urllib.request.Request(f"{BASE_URL}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, context=ctx, timeout=10) as res:
            raw = res.read().decode('utf-8')
            return res.status, json.loads(raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode('utf-8')
        try:
            return e.code, json.loads(raw)
        except:
            return e.code, raw
    except Exception as e:
        return 0, str(e)

print("--- 1. Login with student.applicant@example.com ---")
status, res = req("/auth/login", "POST", {
    "email": "student.applicant@example.com",
    "password": "SecurePassword123!",
    "organizationCode": "org1"
})
print("Login status:", status)
token = None
user = None
if status == 200:
    user = res.get('data', {}).get('user')
    token = res.get('data', {}).get('accessToken')
    print("User ID:", user.get('id'))
    print("User Name:", user.get('fullName'))
    print("User Role:", user.get('role'))
    print("Token prefix:", token[:25])
else:
    print("Login response:", res)

if token:
    print("\n--- 2. Testing GET /discussion/inbox ---")
    st, inbox = req("/discussion/inbox", "GET", token=token)
    print("Inbox status:", st)
    print("Inbox data keys:", list(inbox.get('data', {}).keys()) if isinstance(inbox.get('data'), dict) else inbox)
    print("Inbox content:", json.dumps(inbox, indent=2)[:500])

    print("\n--- 3. Testing GET /discussion/contacts ---")
    st, contacts = req("/discussion/contacts", "GET", token=token)
    print("Contacts status:", st)
    print("Contacts:", json.dumps(contacts, indent=2)[:500])

