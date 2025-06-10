import axios from 'axios';
import { store } from '../store/store';
import { logout } from '../store/slices/authSlice';

// Determine the API base URL dynamically
const getApiBaseUrl = () => {
  // Use the environment variable if set, otherwise fall back to deployed backend
  const apiUrl = 'https://ftd-2sqp.onrender.com/api' || '/api';
  
  console.log('API Base URL:', apiUrl);
  
  return apiUrl;
};

// Create axios instance
const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const state = store.getState();
    const token = state.auth.token;

    console.log('API Request:', {
      url: config.url,
      method: config.method,
      hasToken: !!token
    });

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error;

    console.error('API Response Error:', {
      status: response?.status,
      statusText: response?.statusText,
      data: response?.data,
      config: error.config
    });

    // Handle 401 unauthorized - logout user
    if (response?.status === 401) {
      store.dispatch(logout());
      window.location.href = '/login';
    }

    // Handle network errors
    if (!response) {
      error.message = 'Network error. Please check your connection.';
    }

    return Promise.reject(error);
  }
);

export default api;