import urllib.request
import re

url = "https://launchpaad.tech/macslearnfrontend/assets/index-B-vMsWQS.js"
try:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp:
        content = resp.read().decode("utf-8")
    print(f"Downloaded bundle, size: {len(content)}")
    
    # Search for certificates API calls
    patterns = [
        r'certificates[a-zA-Z0-9_\-\/\?&=:]*',
        r'my-certificates',
        r'certificate[a-zA-Z0-9_\-\/\?&=:]*'
    ]
    for p in patterns:
        m = re.findall(p, content, re.IGNORECASE)
        print(f"Pattern '{p}': {len(m)} matches: {set(m[:10])}")
        
    # Search for occurrences of 'my-certificates' with surrounding context
    for match in re.finditer(r'my-certificates', content):
        start = max(0, match.start() - 250)
        end = min(len(content), match.end() + 250)
        print("\n--- Context for my-certificates ---")
        print(content[start:end])

    # Search for /certificates/request
    for match in re.finditer(r'certificates/request', content):
        start = max(0, match.start() - 250)
        end = min(len(content), match.end() + 250)
        print("\n--- Context for certificates/request ---")
        print(content[start:end])

except Exception as e:
    print("Error:", e)

