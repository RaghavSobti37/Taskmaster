const FinanceDocument = require('../models/FinanceDocument');
const Project = require('../models/Project');
const {
  resolveProjectReferencePrefix,
  formatReferenceNumber,
  parseReferenceSequence,
} = require('../../shared/financeReferenceCatalog');

async function getReferencePrefixForProject(projectId) {
  const project = await Project.findById(projectId).select('name workspace').lean();
  if (!project) return null;
  return resolveProjectReferencePrefix(project);
}

async function getNextReferenceNumbers(projectId, count = 1) {
  const qty = Math.max(1, Math.min(Number(count) || 1, 50));
  const prefix = await getReferencePrefixForProject(projectId);
  if (!prefix) return [];

  const escaped = String(prefix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const docs = await FinanceDocument.find({
    project: projectId,
    isFolder: { $ne: true },
    referenceNumber: { $regex: `^${escaped}-`, $options: 'i' },
  })
    .select('referenceNumber')
    .lean();

  let maxSeq = 0;
  for (const doc of docs) {
    maxSeq = Math.max(maxSeq, parseReferenceSequence(doc.referenceNumber, prefix));
  }

  const refs = [];
  for (let i = 1; i <= qty; i += 1) {
    refs.push(formatReferenceNumber(prefix, maxSeq + i));
  }
  return refs;
}

/** In-memory allocator for bulk uploads — one DB scan per project. */
function createReferenceAllocator() {
  const state = new Map();

  const ensureProject = async (projectId) => {
    if (state.has(String(projectId))) return;
    const prefix = await getReferencePrefixForProject(projectId);
    if (!prefix) {
      state.set(String(projectId), { prefix: 'GEN', nextSeq: 1 });
      return;
    }

    const escaped = String(prefix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const docs = await FinanceDocument.find({
      project: projectId,
      isFolder: { $ne: true },
      referenceNumber: { $regex: `^${escaped}-`, $options: 'i' },
    })
      .select('referenceNumber')
      .lean();

    let maxSeq = 0;
    for (const doc of docs) {
      maxSeq = Math.max(maxSeq, parseReferenceSequence(doc.referenceNumber, prefix));
    }
    state.set(String(projectId), { prefix, nextSeq: maxSeq + 1 });
  };

  const allocate = async (projectId, explicitRef) => {
    const trimmed = (explicitRef || '').trim();
    if (trimmed) return trimmed;
    await ensureProject(projectId);
    const entry = state.get(String(projectId));
    const ref = formatReferenceNumber(entry.prefix, entry.nextSeq);
    entry.nextSeq += 1;
    return ref;
  };

  return { allocate };
}

module.exports = {
  getReferencePrefixForProject,
  getNextReferenceNumbers,
  createReferenceAllocator,
  resolveProjectReferencePrefix,
  formatReferenceNumber,
};
