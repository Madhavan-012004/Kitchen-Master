import api from './client.js'

// ── Clothing Products ────────────────────────────────────────────────────────
export const getClothingProducts = () => api.get('/clothing/products')
export const createClothingProduct = (data) => api.post('/clothing/products', data)
export const updateClothingProduct = (id, data) => api.put(`/clothing/products/${id}`, data)
export const deleteClothingProduct = (id) => api.delete(`/clothing/products/${id}`)

// ── Clothing Variants ────────────────────────────────────────────────────────
export const getVariantsForProduct = (productId) => api.get(`/clothing/products/${productId}/variants`)
export const getAllVariants = (q) => api.get('/clothing/variants', { params: q ? { q } : {} })
export const createClothingVariant = (productId, data) => api.post(`/clothing/products/${productId}/variants`, data)
export const updateClothingVariant = (id, data) => api.put(`/clothing/variants/${id}`, data)
export const restockVariant = (id, data) => api.post(`/clothing/variants/${id}/restock`, data)
export const transferVariant = (id, data) => api.post(`/clothing/variants/${id}/transfer`, data)
export const getLowStockVariants = () => api.get('/clothing/variants/low-stock')
export const getClothingStats = () => api.get('/clothing/stats')

// ── Tailoring Jobs ───────────────────────────────────────────────────────────
export const getTailoringJobs = (status) => api.get('/tailoring/jobs', { params: status ? { status } : {} })
export const createTailoringJob = (data) => api.post('/tailoring/jobs', data)
export const getTailoringJob = (id) => api.get(`/tailoring/jobs/${id}`)
export const getJobByToken = (token) => api.get(`/tailoring/jobs/token/${token}`)
export const getJobsByPhone = (phone) => api.get(`/tailoring/jobs/phone/${phone}`)
export const updateTailoringStatus = (id, status) => api.patch(`/tailoring/jobs/${id}/status`, { status })
export const deliverTailoringJob = (id, data) => api.patch(`/tailoring/jobs/${id}/deliver`, data)
export const getTailoringStats = () => api.get('/tailoring/stats')
