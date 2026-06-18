/** ESM facade for Vite client; Node uses crmDigestProjects.cjs directly. */
export {
  CRM_DIGEST_PLAN_OPTIONS,
  CRM_DIGEST_SEGMENTS,
  getCrmDigestSegmentForProject,
  getCrmDigestSegmentForWorkspace,
  emptyPlanValues,
  emptyCrmDigestSettings,
  normalizePlanValues,
} from './crmDigestProjects.cjs';
