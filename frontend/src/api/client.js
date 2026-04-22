import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 300000,  // 5 minutes
})

export const newSession = () => api.post('/api/session/new')
export const reviewReport = (record) => api.post('/api/review', record)
export const generateResponse = (record) => api.post('/api/respond', record)
export const getSession = (id) => api.get(`/api/session/${id}`)
export const getHistory = () => api.get('/api/history')