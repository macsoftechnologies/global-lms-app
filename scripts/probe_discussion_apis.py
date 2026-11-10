import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

base_lms = "https://launchpaad.tech/macslearnbackend/api/v1"
base_raos = "https://api.raoslawacademy.com"

def api_call(url, method="GET", payload=None, token=None):
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(payload).encode('utf-8') if payload else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=8) as res:
            text = res.read().decode('utf-8')
            try:
                return res.status, json.loads(text)
            except:
                return res.status, text
    except urllib.error.HTTPError as e:
        text = e.read().decode('utf-8')
        try:
            return e.code, json.loads(text)
        except:
            return e.code, text
    except Exception as e:
        return 0, str(e)

print("--- 1. Authenticate Student on Launchpaad ---")
s_code, s_login = api_call(f"{base_lms}/auth/login", "POST", {
    "email": "vasupallivarsha@gmail.com",
    "password": "password123",
    "organizationCode": "org1"
})
print("Student login code:", s_code)
student_token = None
student_user = None
if isinstance(s_login, dict):
    student_token = s_login.get('data', {}).get('accessToken') or s_login.get('accessToken')
    student_user = s_login.get('data', {}).get('user') or s_login.get('user')
print("Student User ID:", student_user.get('id') if student_user else "None")
print("Student Token present:", bool(student_token))

print("\n--- 2. Probe /discussion endpoints on Launchpaad ---")
for ep in [
    "/discussion/inbox",
    "/discussion/direct-thread",
    "/discussion/threads",
    "/discussion/topics",
    "/users/chat-roster",
    "/users",
    "/admin",
    "/tickets"
]:
    code, res = api_call(f"{base_lms}{ep}", "GET", token=student_token)
    res_str = str(res)[:120] if res else ""
    print(f"GET {ep} -> {code}: {res_str}")

print("\n--- 3. Probe Raos Law Academy Tickets & Users ---")
r_code, r_tickets = api_call(f"{base_raos}/tickets/user-list", "POST", {
    "userId": student_user.get('id') if student_user else "4237c5bb-30d1-495a-96f8-d70ba48ec110",
    "page": 1,
    "limit": 10
})
print("Raos /tickets/user-list ->", r_code, str(r_tickets)[:150])

r_adm_code, r_adm_tickets = api_call(f"{base_raos}/tickets/admin/list?page=1&limit=10", "GET")
print("Raos /tickets/admin/list ->", r_adm_code, str(r_adm_tickets)[:150])

r_users_code, r_users = api_call(f"{base_raos}/users", "GET")
print("Raos /users ->", r_users_code, str(r_users)[:150])

