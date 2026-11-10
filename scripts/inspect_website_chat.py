import urllib.request
import re
import ssl
import json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

base = "https://launchpaad.tech/macslearnfrontend/admin/chat"

print("1. Fetching website HTML from:", base)
req = urllib.request.Request(base, headers={"User-Agent": "Mozilla/5.0"})
try:
    with urllib.request.urlopen(req, context=ctx, timeout=10) as res:
        html = res.read().decode('utf-8', errors='ignore')
        print("HTML length:", len(html))
        
        # Find all script src
        scripts = re.findall(r'src=["\']([^"\']+\.js)["\']', html)
        print("Script tags found:", scripts)
        
        for s in scripts:
            if not s.startswith("http"):
                if s.startswith("/"):
                    script_url = f"https://launchpaad.tech{s}"
                else:
                    script_url = f"https://launchpaad.tech/macslearnfrontend/{s}"
            else:
                script_url = s
                
            print(f"\nFetching JS: {script_url}")
            try:
                with urllib.request.urlopen(urllib.request.Request(script_url, headers={"User-Agent": "Mozilla/5.0"}), context=ctx, timeout=15) as s_res:
                    js_code = s_res.read().decode('utf-8', errors='ignore')
                    print(f"Loaded {len(js_code)} chars")
                    
                    # Search for chat, discussion, /admin/chat, etc.
                    keywords = [
                        "admin/chat", "student/chat", "discussion", "direct-thread",
                        "threads", "tickets", "socket", "Socket", "io(", "messages"
                    ]
                    for kw in keywords:
                        matches = [m.start() for m in re.finditer(re.escape(kw), js_code, re.IGNORECASE)]
                        if matches:
                            print(f"  -> Found '{kw}' ({len(matches)} matches). Snippet:")
                            idx = matches[0]
                            snippet = js_code[max(0, idx - 150): min(len(js_code), idx + 250)]
                            print("     ", repr(snippet))
                            
                            # Save full snippet context to a file for analysis
                            with open(f"scripts/extracted_{kw.replace('/', '_')}.txt", "w", encoding="utf-8") as out:
                                for m_idx in matches[:15]:
                                    out.write(f"\n--- MATCH AT {m_idx} ---\n")
                                    out.write(js_code[max(0, m_idx - 300): min(len(js_code), m_idx + 400)])
                                    out.write("\n")
            except Exception as e:
                print("Failed to fetch JS:", script_url, e)

except Exception as e:
    print("Failed to fetch HTML:", e)

