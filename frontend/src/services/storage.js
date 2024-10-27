export const getStoredToken = () => localStorage.getItem('token');
export const setStoredToken = (token) => localStorage.setItem('token', token);
export const removeStoredToken = () => localStorage.removeItem('token');