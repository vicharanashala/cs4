import axios from 'axios';
import { getOrCreateFingerprint, getDeviceInfo } from './deviceFingerprint';

const getCsrfToken = () => {
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : '';
};

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Attach CSRF token + device identity headers to every request
api.interceptors.request.use((config) => {
  const mutating = ['post', 'put', 'patch', 'delete'];
  if (mutating.includes(config.method?.toLowerCase())) {
    config.headers['X-CSRF-Token'] = getCsrfToken();
  }

  try {
    const fp = getOrCreateFingerprint();
    const { brand, model, os } = getDeviceInfo();
    config.headers['X-Device-Fingerprint'] = fp;
    config.headers['X-Device-Brand']       = brand;
    config.headers['X-Device-Model']       = model;
    config.headers['X-Device-Os']          = os;
  } catch {
    // non-fatal — device headers are best-effort
  }

  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error) => {
  failedQueue.forEach((prom) => (error ? prom.reject(error) : prom.resolve()));
  failedQueue = [];
};

// Auto-refresh on 401 TOKEN_EXPIRED
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      error.response?.data?.code === 'TOKEN_EXPIRED' &&
      !original._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(original));
      }

      original._retry = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh');
        processQueue(null);
        return api(original);
      } catch (refreshErr) {
        processQueue(refreshErr);
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
