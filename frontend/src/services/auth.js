import api from './api';
import { setStoredToken, removeStoredToken } from './storage';

export const login = async (email, password) => {
  try {
    const response = await api.post('/auth/login', { email, password });
    const { token } = response.data;
    setStoredToken(token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const logout = () => {
  removeStoredToken();
  delete api.defaults.headers.common['Authorization'];
};