import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def test_ep(base, method, path, payload=None, token=None):
    url = f"{base}{path}"
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(payload).encode('utf-8') if payload else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=6) as res:
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

print("=== 1. Probing https://launchpaad.tech/macslearnbackend/api/v1 ===")
lms = "https://launchpaad.tech/macslearnbackend/api/v1"
code, res = test_ep(lms, "POST", "/discussion/direct-thread", {"targetUserId": "admin-1", "initialMessage": "Hello"})
print("POST /discussion/direct-thread ->", code, res)

code, res = test_ep(lms, "GET", "/discussion/inbox")
print("GET /discussion/inbox ->", code, res)

code, res = test_ep(lms, "POST", "/discussion/threads/test-thread/messages", {"message": "Hello"})
print("POST /discussion/threads/:id/messages ->", code, res)

code, res = test_ep(lms, "GET", "/discussion/threads/test-thread/messages")
print("GET /discussion/threads/:id/messages ->", code, res)

print("\n=== 2. Probing https://api.raoslawacademy.com ===")
raos = "https://api.raoslawacademy.com"
code, res = test_ep(raos, "POST", "/discussion/direct-thread", {"targetUserId": "admin-1", "initialMessage": "Hello"})
print("Raos POST /discussion/direct-thread ->", code, res)

code, res = test_ep(raos, "GET", "/discussion/inbox")
print("Raos GET /discussion/inbox ->", code, res)

print("\n=== 3. Probing Raos Tickets / Chat API ===")
# Let's test Raos tickets creation
code, res = test_ep(raos, "POST", "/tickets/create", {
    "userId": "4237c5bb-30d1-495a-96f8-d70ba48ec110",
    "type": "support",
    "title": "Academic Counseling Inquiry",
    "description": "Student reaching out to Academic Administration",
    "subject": "Discussion & Chat"
})
print("Raos POST /tickets/create ->", code, res)

