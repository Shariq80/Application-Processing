import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getStoredToken, setStoredToken, removeStoredToken } from '../services/storage';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    removeStoredToken();
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const checkAuthStatus = useCallback(async () => {
    try {
      const token = getStoredToken();
      const userId = localStorage.getItem('userId');
      
      if (!token || !userId) {
        setLoading(false);
        return;
      }
      
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      api.defaults.headers.common['x-user-id'] = userId;
      
      const response = await api.get('/auth/check');
      setUser(response.data);
    } catch (error) {
      logout();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, user } = response.data;
    setStoredToken(token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(user);
    return user;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
