import axios from 'axios';

const API_BASE = import.meta.env.PROD || !window.location.origin.includes('localhost') 
  ? '/api' 
  : 'http://localhost:5000/api';

export const api = axios.create({ baseURL: API_BASE });

export const chat = (formData) => api.post('/chat', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});

export const getConversations = () => api.get('/conversations').then(r => r.data);
export const getMessages = (convId) => api.get(`/conversations/${convId}/messages`).then(r => r.data);
export const deleteConversation = (convId) => api.delete(`/conversations/${convId}`);
export const getStats = () => api.get('/stats').then(r => r.data);
export const exportConversation = (convId) => api.get(`/conversations/${convId}/export`).then(r => r.data);
