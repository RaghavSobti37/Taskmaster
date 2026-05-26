const fs = require('fs');
require('dotenv').config();

const files = JSON.parse(fs.readFileSync('basecamp_files.json', 'utf8'));

console.log('--- Basecamp Download (1) files ---');
console.log(files['Basecamp Download (1)'] || []);

console.log('--- Basecamp Download (2) files ---');
console.log(files['Basecamp Download (2)'] || []);

console.log('--- Basecamp Download (3) files ---');
console.log(files['Basecamp Download (3)'] || []);

console.log('--- Basecamp Download (5) files ---');
console.log(files['Basecamp Download (5)'] || []);
