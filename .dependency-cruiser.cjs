/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-feature-cross-imports',
      comment: 'Features must not import another feature internals',
      severity: 'error',
      from: { path: '^client/src/features/([^/]+)/' },
      to: { path: '^client/src/features/(?!\\1)[^/]+/(api|hooks|components)/' },
    },
    {
      name: 'packages-are-leaves',
      comment: 'Packages should not import from client app',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^client/' },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: false,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
