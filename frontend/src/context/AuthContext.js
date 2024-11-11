import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  getStoredToken, 
  setStoredToken, 
  removeStoredToken,
  setStoredUserId 
} from '../services/storage';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const setupAxiosInterceptors = useCallback(() => {
    api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logout();
        }
        return Promise.reject(error);
      }
    );
  }, []);

  const logout = useCallback(() => {
    removeStoredToken();
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      const token = getStoredToken();
      if (!token) {
        setLoading(false);
        return;
      }

      // Set token in axios defaults
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      const response = await api.get('/auth/check');
      setUser(response.data);
    } catch (error) {
      console.error('Auth check failed:', error);
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  // Initialize auth check and axios interceptors
  useEffect(() => {
    if (!initialized) {
      setupAxiosInterceptors();
      checkAuthStatus();
      setInitialized(true);
    }
  }, [initialized, setupAxiosInterceptors, checkAuthStatus]);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;
      
      setStoredToken(token);
      setStoredUserId(user.id);
      
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      
      return user;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
