const { buildFinalEmailHtml, wrapPreviewDocument } = require('../utils/buildFinalEmailHtml');

(async () => {
  const cases = [
    ['ql-indent class', '<p>line1</p><p class="ql-indent-1">indented</p><p class="ql-indent-2">double</p>'],
    ['inline padding-left', '<p>line1</p><p style="padding-left: 3em">indented</p><p style="padding-left: 6em">double</p>'],
  ];

  for (const [label, html] of cases) {
    const body = await buildFinalEmailHtml({
      html,
      removeUnsubscribe: true,
      includeSignature: false,
      mode: 'preview',
    });
    console.log(`\n[${label}]`);
    console.log('3em:', /padding-left:\s*3em/i.test(body));
    console.log('6em:', /padding-left:\s*6em/i.test(body));
  }
})();
