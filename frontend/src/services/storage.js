export const getStoredToken = () => localStorage.getItem('token');
export const setStoredToken = (token) => localStorage.setItem('token', token);
export const removeStoredToken = () => localStorage.removeItem('token');

export const getStoredUserId = () => localStorage.getItem('userId');
export const setStoredUserId = (userId) => localStorage.setItem('userId', userId);
export const removeStoredUserId = () => localStorage.removeItem('userId');