/**
 * Utility to enforce pagination on Mongoose queries to prevent unbounded data retrieval.
 * @param {Object} model - Mongoose model
 * @param {Object} query - MongoDB query object (e.g., { tenantId: '123' })
 * @param {Object} options - Options containing req.query params
 * @param {String} [options.page=1] - Current page number
 * @param {String} [options.limit=50] - Documents per page
 * @param {Object} [options.sort={ createdAt: -1 }] - Sort options
 * @param {String} [options.populate=''] - Fields to populate
 * @returns {Object} { data, pagination: { total, page, pages } }
 */
async function paginatedQuery(model, query = {}, options = {}) {
  const page = parseInt(options.page, 10) || 1;
  const limit = parseInt(options.limit, 10) || 50; // Hard cap default at 50
  const skip = (page - 1) * limit;
  const sort = options.sort || { createdAt: -1 };

  let mongooseQuery = model.find(query).sort(sort).skip(skip).limit(limit).lean();

  if (options.populate) {
    mongooseQuery = mongooseQuery.populate(options.populate);
  }

  const [data, total] = await Promise.all([
    mongooseQuery.exec(),
    model.countDocuments(query).exec()
  ]);

  return {
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
}

module.exports = paginatedQuery;
