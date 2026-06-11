const { getTenantId } = require('../utils/tenantContext');
const { tenantIdFilter } = require('../utils/mongoId');
const { withTenantFilter, applyToQuery } = require('./tenantQuery');

/**
 * Factory for domain repositories with explicit tenant scoping via tenantQuery helpers.
 * Returns chainable mongoose queries where applicable (find/findOne).
 */
function createTenantRepository(Model) {
  function tenantMatchStage(options = {}) {
    if (options.bypass) return null;
    const tid = options.tenantId || getTenantId();
    return tid ? tenantIdFilter(tid) : null;
  }

  return {
    find(filter = {}, options = {}) {
      return applyToQuery(Model.find(withTenantFilter(filter, options)), options);
    },

    findOne(filter = {}, options = {}) {
      return applyToQuery(Model.findOne(withTenantFilter(filter, options)), options);
    },

    findById(id, options = {}) {
      return this.findOne({ _id: id }, options);
    },

    countDocuments(filter = {}, options = {}) {
      return applyToQuery(Model.countDocuments(withTenantFilter(filter, options)), options);
    },

    aggregate(pipeline, options = {}) {
      const match = tenantMatchStage(options);
      const fullPipeline = match ? [{ $match: match }, ...pipeline] : pipeline;
      return Model.aggregate(fullPipeline);
    },

    create(doc) {
      return Model.create(doc);
    },

    findOneAndUpdate(filter, update, options = {}) {
      return applyToQuery(
        Model.findOneAndUpdate(withTenantFilter(filter, options), update, options),
        options,
      );
    },

    findByIdAndUpdate(id, update, options = {}) {
      return this.findOneAndUpdate({ _id: id }, update, options);
    },
  };
}

module.exports = { createTenantRepository };
