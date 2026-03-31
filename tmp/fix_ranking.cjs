const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'KeywordRanking.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// Replace standard tailwind font classes to step them up
// We want text-xs -> text-sm, text-[9px] -> text-[10px], text-[10px] -> text-[11px] or xs
code = code.replace(/\btext-xs\b/g, 'text-sm');
code = code.replace(/\btext-\[9px\]\b/g, 'text-[10px]');
code = code.replace(/\btext-\[10px\]\b/g, 'text-xs');

fs.writeFileSync(filePath, code);
console.log('KeywordRanking fonts resized successfully!');
