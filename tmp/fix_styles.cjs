const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/onlin/Desktop/Sales/src/pages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx') && f !== 'Dashboard.tsx');

for (let file of files) {
    const fullPath = path.join(dir, file);
    let code = fs.readFileSync(fullPath, 'utf8');
    
    code = code.replace(/font-extrabold/g, 'font-semibold');
    code = code.replace(/font-bold/g, 'font-medium');
    code = code.replace(/text-gray-800/g, 'text-slate-700');
    code = code.replace(/text-gray-900/g, 'text-slate-700');
    code = code.replace(/text-slate-800/g, 'text-slate-700');
    code = code.replace(/text-slate-900/g, 'text-slate-700');
    code = code.replace(/text-blue-600/g, 'text-sky-500');
    code = code.replace(/text-blue-700/g, 'text-sky-600');
    code = code.replace(/text-red-700/g, 'text-rose-500');
    code = code.replace(/text-red-800/g, 'text-rose-600');
    code = code.replace(/bg-slate-800/g, 'bg-sky-100');
    code = code.replace(/bg-gray-100/g, 'bg-slate-50');
    code = code.replace(/bg-slate-100/g, 'bg-slate-50');

    fs.writeFileSync(fullPath, code, 'utf8');
}
console.log("Done");
