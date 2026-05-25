const axios = require('axios');

const SERVICE_CONFIG = {
  holysheet: {
    baseUrl: 'https://holysheet.soneshjain.com/api/v1',
    apiKey: process.env.HOLYSHEET_API_KEY || process.env.HOLY_SHEET_API_KEY,
    authType: 'path',
    allowedMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
  },
  exly: {
    baseUrl: process.env.EXLY_API_URL || 'https://api.exly.com',
    apiKey: process.env.EXLY_API_KEY,
    authType: 'header',
    headerName: 'x-api-key',
    allowedMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
  },
  youtube: {
    baseUrl: 'https://www.googleapis.com/youtube/v3',
    apiKey: process.env.YOUTUBE_API_KEY,
    authType: 'query',
    queryParam: 'key',
    allowedMethods: ['GET']
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    authType: 'bearer',
    headerName: 'Authorization',
    allowedMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
  }
};

const getServiceConfig = (service) => {
  return SERVICE_CONFIG[service];
};

const buildTargetUrl = (serviceConfig, servicePath = '') => {
  const normalizedPath = servicePath.startsWith('/') ? servicePath : `/${servicePath}`;

  if (serviceConfig.authType === 'path') {
    if (!serviceConfig.apiKey) {
      throw new Error('Missing API key for proxy service');
    }
    return `${serviceConfig.baseUrl}/${serviceConfig.apiKey}${normalizedPath}`;
  }

  return `${serviceConfig.baseUrl}${normalizedPath}`;
};

const cleanupQuery = (query) => {
  const cleaned = { ...query };
  delete cleaned.service;
  delete cleaned.path;
  return cleaned;
};

exports.handleProxyRequest = async (req, res) => {
  try {
    const serviceKey = req.params.service;
    const servicePath = req.params[0] || '';
    const serviceConfig = getServiceConfig(serviceKey);

    if (!serviceConfig) {
      return res.status(404).json({ error: `Proxy service not found: ${serviceKey}` });
    }

    if (!serviceConfig.allowedMethods.includes(req.method)) {
      return res.status(405).json({ error: `Method ${req.method} not allowed for this service` });
    }

    if (!serviceConfig.apiKey) {
      return res.status(500).json({ error: `Server-side API key missing for proxy service: ${serviceKey}` });
    }

    const targetUrl = buildTargetUrl(serviceConfig, servicePath);
    const params = cleanupQuery(req.query);
    const headers = {
      accept: 'application/json',
      'content-type': 'application/json',
      ...req.headers
    };

    // Remove sensitive headers that should not be forwarded
    delete headers.host;
    delete headers.cookie;
    delete headers.authorization;
    delete headers['content-length'];
    delete headers.origin;
    delete headers.referer;

    if (serviceConfig.authType === 'header') {
      headers[serviceConfig.headerName] = serviceConfig.apiKey;
    } else if (serviceConfig.authType === 'bearer') {
      headers[serviceConfig.headerName] = `Bearer ${serviceConfig.apiKey}`;
    } else if (serviceConfig.authType === 'query') {
      params[serviceConfig.queryParam] = serviceConfig.apiKey;
    }

    const axiosConfig = {
      url: targetUrl,
      method: req.method.toLowerCase(),
      headers,
      params,
      timeout: 20000,
      validateStatus: () => true
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      axiosConfig.data = req.body;
    }

    const response = await axios(axiosConfig);

    res.status(response.status);
    if (response.headers['content-type'] && response.headers['content-type'].includes('application/json')) {
      return res.json(response.data);
    }

    return res.send(response.data);
  } catch (error) {
    if (error.response) {
      return res.status(error.response.status || 502).json({
        error: error.response.data || error.message
      });
    }

    return res.status(500).json({ error: error.message });
  }
};
