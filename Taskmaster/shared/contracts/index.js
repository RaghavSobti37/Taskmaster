const crm = require('./crm');
const safeValues = require('./safeValues');
const attendance = require('./attendance');

module.exports = {
  ...crm,
  ...safeValues,
  ...attendance,
};