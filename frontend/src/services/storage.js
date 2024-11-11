const TOKEN_KEY = 'token';
const USER_ID_KEY = 'userId';

export const setStoredToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
};

export const getStoredToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

export const removeStoredToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
};

export const setStoredUserId = (userId) => {
  if (userId) {
    localStorage.setItem(USER_ID_KEY, userId);
  }
};

export const getStoredUserId = () => {
  return localStorage.getItem(USER_ID_KEY);
};