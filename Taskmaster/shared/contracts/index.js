const crm = require('./crm');
const mail = require('./mail');
const safeValues = require('./safeValues');
const attendance = require('./attendance');

module.exports = {
  ...crm,
  ...mail,
  ...safeValues,
  ...attendance,
};
