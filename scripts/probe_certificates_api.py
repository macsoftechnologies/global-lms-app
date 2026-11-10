import urllib.request
import json
import ssl
import random
import time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

BASE_URL = "https://launchpaad.tech/macslearnbackend/api/v1"

def api_request(endpoint, method="GET", payload=None, token=None):
    url = f"{BASE_URL}{endpoint}"
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    data = json.dumps(payload).encode('utf-8') if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as res:
            body = res.read().decode('utf-8')
            try:
                parsed = json.loads(body)
            except:
                parsed = body
            return res.status, parsed
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            parsed = json.loads(body)
        except:
            parsed = body
        return e.code, parsed
    except Exception as e:
        return 500, str(e)

print("=== 1. Student Auth Setup ===")
rand = random.randint(10000, 99999)
email = f"cert.student.{rand}@example.com"
password = "Password123!"

# Register
reg_status, reg_data = api_request("/auth/register", "POST", {
    "fullName": f"Cert Test Student {rand}",
    "email": email,
    "password": password,
    "mobile": f"+9198765{rand}",
    "organizationCode": "org1",
    "regionId": "d1f2c9a6-a193-4f48-a9c4-acc4cabc9350",
    "ataStatus": "ATA",
    "customProfile": {
        "ataStatus": "ATA",
        "declarationAccepted": True
    }
})

login_status, login_data = api_request("/auth/login", "POST", {
    "email": email,
    "password": password,
    "organizationCode": "org1"
})

token = None
if isinstance(login_data, dict):
    token = login_data.get("accessToken") or (login_data.get("data") or {}).get("accessToken")

print(f"Login status: {login_status}, Token acquired: {bool(token)}")

print("\n=== 2. Probing GET /certificates/my-certificates ===")
status_unauth, unauth_data = api_request("/certificates/my-certificates", "GET")
print("Unauthenticated status:", status_unauth, unauth_data)

status_auth, my_certs = api_request("/certificates/my-certificates", "GET", token=token)
print("Authenticated status:", status_auth)
print("Response data:", json.dumps(my_certs, indent=2))

print("\n=== 3. Probing GET /courses to get a courseId ===")
c_status, c_data = api_request("/courses/public?limit=5", "GET")
if not isinstance(c_data, dict) or not c_data.get("data"):
    c_status, c_data = api_request("/courses?limit=5", "GET", token=token)

courses = []
if isinstance(c_data, dict):
    courses = c_data.get("data", []) if isinstance(c_data.get("data"), list) else c_data.get("courses", [])

course_id = courses[0].get("id") or courses[0].get("_id") if courses else "mock_course_id"
print(f"Sample Course ID: {course_id}")

print("\n=== 4. Probing POST /certificates/request ===")
req_status, req_res = api_request("/certificates/request", "POST", {"courseId": course_id}, token=token)
print(f"Request Certificate status: {req_status}")
print("Response data:", json.dumps(req_res, indent=2))

print("\n=== 5. Probing GET /certificates/:certificateId ===")
test_cert_id = "non-existent-id-12345"
cert_status, cert_res = api_request(f"/certificates/{test_cert_id}", "GET", token=token)
print(f"Get Certificate by ID status: {cert_status}")
print("Response data:", json.dumps(cert_res, indent=2))

print("\n=== 6. Probing GET /certificates/courses/:courseId ===")
course_cert_status, course_cert_res = api_request(f"/certificates/courses/{course_id}", "GET", token=token)
print(f"Get Certificate for Course status: {course_cert_status}")
print("Response data:", json.dumps(course_cert_res, indent=2))

