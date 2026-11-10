import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

base_url = "https://launchpaad.tech/macslearnbackend/api/v1"

def do_post(endpoint, payload, token=None):
    url = f"{base_url}{endpoint}"
    data_bytes = json.dumps(payload).encode('utf-8')
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data_bytes, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx) as response:
            return response.status, json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8')

def do_get(endpoint, token=None):
    url = f"{base_url}{endpoint}"
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx) as response:
            return response.status, json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8')

# Login as student
status, login_res = do_post("/auth/login", {
    "email": "student.applicant@example.com",
    "password": "SecurePassword123!",
    "organizationCode": "org1"
})

print("Login status:", status)
token = None
if isinstance(login_res, dict):
    token = login_res.get('data', {}).get('accessToken') or login_res.get('accessToken')

print("Token:", token[:20] if token else "No token")

if token:
    for ep in ["/discussion/inbox", "/discussion/contacts"]:
        st, res = do_get(ep, token)
        print(f"GET {ep} -> {st} : {str(res)[:200]}")

