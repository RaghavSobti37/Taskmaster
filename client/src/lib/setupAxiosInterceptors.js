import axios from 'axios';
import {
  slugId,
  parseErrorPayload,
  shouldShowApiSuccessToast,
  shouldShowApiErrorToast,
} from './notifications';
import { emitSystemEvent, getClientTraceId, startClientTrace } from './systemLogBridge';
import { inferModuleFromRoute, SEVERITY } from './systemLogContract';
import { normalizeProject, normalizeProjects, normalizePopulatedProjectList } from '../utils/projectUtils';
import { normalizeTasks, normalizeSchedulePayload } from '../utils/normalizeTask';
import { triggerUnauthorized } from './authUnauthorized';
import {
  clerkOrgSelectionUrl,
  isOrgFirstAuthEnabled,
  loadOrgFirstAuthConfig,
} from './orgFirstAuth';

const normalizeProjectsInResponse = (url, data) => {
  if (data == null) return data;
  const path = (url || '').split('?')[0];
  if (path === '/api/projects' || path.endsWith('/api/projects')) {
    return normalizeProjects(data);
  }
  if (/^\/api\/projects\/[^/]+$/.test(path) && data && !Array.isArray(data)) {
    return normalizeProject(data);
  }
  if (path.startsWith('/api/finance') && data?.data) {
    return { ...data, data: normalizePopulatedProjectList(data.data) };
  }
  if (path === '/api/schedule' || path.endsWith('/api/schedule')) {
    return normalizeSchedulePayload(data);
  }
  if (path === '/api/tasks' || path.endsWith('/api/tasks')) {
    return normalizeTasks(data);
  }
  return data;
};

/** Register global axios interceptors (deferred from App mount to shrink initial JS). */
export function setupAxiosInterceptors() {
  void loadOrgFirstAuthConfig();

  const reqInterceptor = axios.interceptors.request.use((config) => {
    if (!config.headers['X-Trace-Id'] && !config.headers['x-trace-id']) {
      config.headers['X-Trace-Id'] = getClientTraceId();
    }
    return config;
  });

  const resInterceptor = axios.interceptors.response.use(
    (response) => {
      if (response.data != null) {
        response.data = normalizeProjectsInResponse(response.config?.url, response.data);
      }
      const method = response.config.method?.toLowerCase();
      if (['post', 'put', 'patch', 'delete'].includes(method) && shouldShowApiSuccessToast(response)) {
        const url = (response.config?.url || '').split('?')[0];
        const message = response.data.message;
        emitSystemEvent({
          severity: SEVERITY.SUCCESS,
          message,
          module: inferModuleFromRoute(url),
          id: slugId('api-ok', method, url),
        });
      }
      if (response.data?.traceId) {
        startClientTrace();
      }
      return response;
    },
    (error) => {
      const method = error.config?.method?.toLowerCase();
      if (['post', 'put', 'patch', 'delete'].includes(method) && shouldShowApiErrorToast(error)) {
        const url = (error.config?.url || '').split('?')[0];
        const { title, description, technicalError, errorCode, status, traceId } = parseErrorPayload(error);
        emitSystemEvent({
          severity: SEVERITY.ERROR,
          title,
          message: title,
          description,
          technicalError,
          errorCode,
          status,
          traceId: traceId || error.response?.headers?.['x-trace-id'] || getClientTraceId(),
          module: inferModuleFromRoute(url),
          timestamp: error.response?.data?.timestamp || new Date().toISOString(),
          id: slugId('api-err', method, url),
        });
      }
      const status = error.response?.status;
      if (status === 401) {
        triggerUnauthorized(error);
      }
      if (status === 409 && error.response?.data?.code === 'NEEDS_TENANT_SELECTION') {
        const path = window.location?.pathname || '';
        if (!path.startsWith('/org/pick') && !path.startsWith('/org/create') && !path.startsWith('/login/choose')) {
          window.location.assign(isOrgFirstAuthEnabled() ? clerkOrgSelectionUrl() : '/org/pick');
        }
      }
      if (status >= 500 && import.meta.env.DEV) {
        console.error('[API]', method, error.config?.url, status, error.response?.data?.traceId);
      }
      return Promise.reject(error);
    }
  );

  return () => {
    axios.interceptors.request.eject(reqInterceptor);
    axios.interceptors.response.eject(resInterceptor);
  };
}
