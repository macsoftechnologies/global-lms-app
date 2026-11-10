import urllib.request

url = 'https://launchpaad.tech/macslearnfrontend/assets/index-B-vMsWQS.js'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as resp:
    content = resp.read().decode('utf-8')

pos = 1878850
start = max(0, pos - 800)
end = min(len(content), pos + 1200)

with open('scripts/extracted_certificate_request_flow.js', 'w', encoding='utf-8') as f:
    f.write(content[start:end])

print(f"Extracted certificate request flow to scripts/extracted_certificate_request_flow.js")

