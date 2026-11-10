const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('C:/Users/dell/.gemini/antigravity/brain/f2067df2-0cb1-4fc3-8e18-8ce99456b36e/.system_generated/logs/transcript.jsonl')
});

rl.on('line', line => {
  if (line.includes('Bearer ') || (line.includes('email') && line.includes('@') && line.includes('password'))) {
    try {
      const parsed = JSON.parse(line);
      const str = JSON.stringify(parsed);
      const matches = str.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g);
      if (matches) {
        console.log('Found emails:', [...new Set(matches)]);
      }
    } catch {}
  }
});

