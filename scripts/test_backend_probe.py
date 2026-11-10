import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def test_endpoint(url):
    print("Testing:", url)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=5) as resp:
            print("Status:", resp.status)
            data = resp.read().decode('utf-8')
            print("Data preview:", data[:200])
    except urllib.error.HTTPError as e:
        print("HTTPError:", e.code, e.read().decode('utf-8')[:200])
    except Exception as e:
        print("Error:", str(e))

test_endpoint("https://launchpaad.tech/macslearnbackend/api/v1/auth/login")
test_endpoint("https://api.raoslawacademy.com/tickets/user-list")

