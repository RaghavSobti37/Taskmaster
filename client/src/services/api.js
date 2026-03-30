import axios from 'axios';

console.log('🔧 [API] Initializing API client...');
console.log('🔧 [API] VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('🔧 [API] NODE_ENV:', import.meta.env.MODE);

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

console.log('🔧 [API] Base URL set to:', api.defaults.baseURL);

// Request interceptor - logs ALL outgoing requests
api.interceptors.request.use(
  (config) => {
    console.log('📤 [API] Outgoing Request:');
    console.log('   Method:', config.method.toUpperCase());
    console.log('   URL:', config.url);
    console.log('   Full URL:', config.baseURL + config.url);
    console.log('   Headers:', config.headers);
    console.log('   Data:', config.data);
    
    const token = localStorage.getItem('token');
    if (token) {
      console.log('📤 [API] Token found, adding Authorization header');
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.log('📤 [API] No token in localStorage');
    }
    
    return config;
  },
  (error) => {
    console.error('❌ [API] Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - logs ALL responses
api.interceptors.response.use(
  (response) => {
    console.log('📥 [API] Response received:');
    console.log('   Status:', response.status);
    console.log('   URL:', response.config.url);
    console.log('   Data:', response.data);
    return response;
  },
  (error) => {
    console.error('❌ [API] Response error:');
    console.error('   Status:', error.response?.status);
    console.error('   URL:', error.config?.url);
    console.error('   Data:', error.response?.data);
    console.error('   Message:', error.message);
    return Promise.reject(error);
  }
);

export default api;