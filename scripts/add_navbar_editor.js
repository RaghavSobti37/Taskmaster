const fs = require('fs');
let code = fs.readFileSync('client/src/components/OutletSidebar.jsx', 'utf8');

const replacement = `        <div className="p-2 border-t border-[var(--color-bg-border)] space-y-1.5">
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} collapsed={!showLabels} isMobile={isMobile} />

          {!(!showLabels && !isMobile) && (
            <button
              onClick={() => setIsNavbarEditorOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg hover:border-blue-500/50 transition-all group overflow-hidden"
            >
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-[var(--color-text-secondary)] group-hover:text-blue-500 transition-colors" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">
                  Navigation
                </span>
              </div>
            </button>
          )}

          {(!showLabels && !isMobile) && (
             <button
              onClick={() => setIsNavbarEditorOpen(true)}
              title="Customize Navigation"
              className="w-full flex items-center justify-center p-2 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] hover:border-blue-500/50 transition-colors"
            >
              <Settings size={16} className="text-[var(--color-text-secondary)] hover:text-blue-500 transition-colors" />
            </button>
          )}

          <div
            onClick={() => navigate('/settings')}`;

const targetString = `        <div className="p-2 border-t border-[var(--color-bg-border)] space-y-1.5">
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} collapsed={!showLabels} isMobile={isMobile} />

          <div
            onClick={() => navigate('/settings')}`;

code = code.replace(targetString, replacement);

const editorComponent = `
      <NavbarEditor
        isOpen={isNavbarEditorOpen}
        onClose={() => setIsNavbarEditorOpen(false)}
        onSave={() => {
          queryClient.invalidateQueries({ queryKey: ['navbarPreferences'] });
          setIsNavbarEditorOpen(false);
        }}
      />
    </>
  );
};
`;

code = code.replace(/    \<\/>\r?\n  \);\r?\n};\r?\n?/, editorComponent);

fs.writeFileSync('client/src/components/OutletSidebar.jsx', code);
console.log('Added button and modal!');
