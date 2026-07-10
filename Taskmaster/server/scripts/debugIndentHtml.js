const fs = require('fs');
const path = require('path');
const { buildFinalEmailHtml } = require('../utils/buildFinalEmailHtml');

const templatePath = path.join(__dirname, '../templates/testing_with_harshika_template.html');
const html = fs.readFileSync(templatePath, 'utf8');

(async () => {
  const beforeBrOnly = (html.match(/<p><br\s*\/?><\/p>/gi) || []).length;
  const final = await buildFinalEmailHtml({ html, mode: 'preview', removeUnsubscribe: true });
  const afterBrOnly = (final.match(/<p><br\s*\/?><\/p>/gi) || []).length;
  console.log('spacer p/br before:', beforeBrOnly, 'after:', afterBrOnly);
  console.log('padding-left:', /padding-left\s*:\s*[^0]/i.test(final));
  console.log('margin-left non-zero:', /margin-left\s*:\s*(?!0)/i.test(final));
  console.log('has shell:', final.includes('font-family:-apple-system'));
  console.log('length:', final.length);
})();
