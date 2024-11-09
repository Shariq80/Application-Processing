import api from './api';
import { setStoredToken, removeStoredToken } from './storage';

export const login = async (email, password) => {
  try {
    const response = await api.post('/auth/login', { email, password });
    const { token, user } = response.data;
    
    // Store both token and userId
    setStoredToken(token);
    localStorage.setItem('userId', user.id);
    
    // Set both in API headers
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    api.defaults.headers.common['x-user-id'] = user.id;
    
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const logout = () => {
  removeStoredToken();
  localStorage.removeItem('userId');
  delete api.defaults.headers.common['Authorization'];
  delete api.defaults.headers.common['x-user-id'];
};