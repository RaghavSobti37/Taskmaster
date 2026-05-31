const fs = require('fs');

let code = fs.readFileSync('client/src/pages/settings/NavbarCustomizationPage.jsx', 'utf8');

// Remove Theme & Text Size logic
code = code.replace(/const \{ theme, toggleTheme, setTheme \} = useTheme\(\);/g, '');
code = code.replace(/const \[textSize, setTextSize\] = useState\('medium'\);/g, '');

const uiTarget = `<div className="flex-1 overflow-y-auto p-8 custom-scrollbar max-w-5xl mx-auto w-full space-y-12 pb-24">`;
const uiReplacement = `<div className="flex-1 overflow-y-auto p-8 custom-scrollbar mx-auto w-full pb-24 h-full">
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 h-full">`;
code = code.replace(uiTarget, uiReplacement);

const themeSectionRegex = /\{\/\* Theme Settings \*\/\}.*?<\/section>\s*<hr className="border-\[var\(--color-bg-border\)\]" \/>/gs;
code = code.replace(themeSectionRegex, '');

// The rest will just naturally fall into the two grid columns if we wrap them correctly.
// Let's close the grid div after the second section.
const endTarget = `</section>

      </div>
    </div>`;

const endReplacement = `</section>
        </div>
      </div>
    </div>`;
code = code.replace(endTarget, endReplacement);

// Remove the <hr> between navbar and dashboard sections
const hrRegex = /<\/section>\s*<hr className="border-\[var\(--color-bg-border\)\]" \/>\s*\{\/\* Dashboard Editor \*\/\}/g;
code = code.replace(hrRegex, `</section>
        {/* Dashboard Editor */}`);

fs.writeFileSync('client/src/pages/settings/NavbarCustomizationPage.jsx', code);
console.log('Customization page updated to 2-column drag-and-drop');
