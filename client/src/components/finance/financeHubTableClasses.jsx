/** Shared desktop table props for Management → Finance documents table. */

export const FINANCE_TABLE_COL = {
  name: 'finance-col-name',
  ref: 'finance-col-ref',
  project: 'finance-col-project',
  category: 'finance-col-category',
  size: 'finance-col-size',
  uploader: 'finance-col-uploader',
  date: 'finance-col-date',
  actions: 'finance-col-actions',
};

export const FINANCE_TABLE_PROPS = {
  density: 'comfortable',
  className: 'finance-hub-table',
  rowEstimateSize: 52,
  virtualize: false,
  paginated: false,
};
