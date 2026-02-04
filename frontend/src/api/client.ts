import axios from 'axios';
import { API_URL } from '@/utils/constants';

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 segundos para operaciones lentas como sync
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
    // Don't redirect to login for public marketplace/checkout endpoints
    const isPublicEndpoint = error.config?.url?.includes('/marketplace/') || 
                             error.config?.url?.includes('/public/') ||
                             error.config?.url?.includes('/checkout');
    
    console.log('🔍 API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      isPublicEndpoint,
      willRedirect: error.response?.status === 401 && !isPublicEndpoint
    });
    
    if (error.response?.status === 401 && !isPublicEndpoint) {
      console.log('❌ Redirecting to login...');
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
