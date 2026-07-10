test('crmConfigService module loads shared sheet assignees', () => {
  expect(() => require('../domains/crm/services/crmConfigService')).not.toThrow();
  const { listImportSheetFilters } = require('../../shared/artistCrmSheetAssignees');
  expect(listImportSheetFilters().length).toBeGreaterThan(10);
});
