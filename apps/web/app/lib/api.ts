import axios from 'axios';

// Create a specialized Axios instance
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a response interceptor for global error handling if needed
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // You can handle global errors here (e.g., redirect to login on 401)
    return Promise.reject(error);
  }
);
