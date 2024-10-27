import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add this after the api creation
api.downloadAttachment = async (applicationId, attachmentId) => {
  try {
    const response = await api.get(
      `/applications/${applicationId}/attachments/${attachmentId}`,
      { responseType: 'blob' }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

export default api;
