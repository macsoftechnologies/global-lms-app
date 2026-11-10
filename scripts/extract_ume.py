import urllib.request

url = 'https://launchpaad.tech/macslearnfrontend/assets/index-B-vMsWQS.js'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as resp:
    content = resp.read().decode('utf-8')

pos = 1917560
start = max(0, pos - 100)
end = min(len(content), pos + 4000)

with open('scripts/extracted_ume_certificates.js', 'w', encoding='utf-8') as f:
    f.write(content[start:end])

print(f"Extracted component to scripts/extracted_ume_certificates.js")

