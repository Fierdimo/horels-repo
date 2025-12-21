import axios from 'axios';
import { API_URL } from '@/utils/constants';

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - add JWT token
apiClient.interceptors.request.use(
  (config) => {
    // Try to get token from localStorage (direct storage)
    let token = localStorage.getItem('sw2_token');
    
    // If not found, try to get from Zustand persist store
    if (!token) {
      const authStore = localStorage.getItem('sw2-auth');
      if (authStore) {
        try {
          const parsed = JSON.parse(authStore);
          token = parsed?.state?.token || null;
        } catch (e) {
          console.error('Failed to parse auth store:', e);
        }
      }
    }
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth from all storage locations
      localStorage.removeItem('sw2_token');
      localStorage.removeItem('sw2_user');
      localStorage.removeItem('sw2-auth');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
