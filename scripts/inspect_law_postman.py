import json

filepath = r"C:/Users/dell/.gemini/antigravity/brain/f2067df2-0cb1-4fc3-8e18-8ce99456b36e/.user_uploaded/media_1794287682936_503d8936.json"
try:
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print("Collection:", data.get('info', {}).get('name'))

    def walk(items, indent=""):
        for item in items:
            if 'item' in item:
                print(f"{indent}[Folder] {item.get('name')}")
                walk(item['item'], indent + "  ")
            elif 'request' in item:
                req = item['request']
                method = req.get('method', 'GET')
                url = req.get('url', {})
                raw_url = url.get('raw') if isinstance(url, dict) else str(url)
                print(f"{indent}{method} {raw_url} ({item.get('name')})")

    walk(data.get('item', []))
except Exception as e:
    print("Error:", e)

