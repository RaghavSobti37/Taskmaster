/** Display/storage format for project names — always ALL CAPS */
const formatProjectName = (name) => {
  if (name == null || name === '') return name;
  return String(name).toUpperCase().trim();
};

module.exports = { formatProjectName };
