import api from './client';

// ── Clothing Products ────────────────────────────────────────────────────────
export const getClothingProducts = () => api.get('/clothing/products');
export const createClothingProduct = (data: any) => api.post('/clothing/products', data);
export const updateClothingProduct = (id: number, data: any) => api.put(`/clothing/products/${id}`, data);
export const deleteClothingProduct = (id: number) => api.delete(`/clothing/products/${id}`);

// ── Clothing Variants ────────────────────────────────────────────────────────
export const getVariantsForProduct = (productId: number) => api.get(`/clothing/products/${productId}/variants`);
export const getAllVariants = (q?: string) => api.get('/clothing/variants', { params: q ? { q } : {} });
export const createClothingVariant = (productId: number, data: any) => api.post(`/clothing/products/${productId}/variants`, data);
export const updateClothingVariant = (id: number, data: any) => api.put(`/clothing/variants/${id}`, data);
export const restockVariant = (id: number, data: { quantity: number; target: 'main' | 'sub' }) => api.post(`/clothing/variants/${id}/restock`, data);
export const transferVariant = (id: number, data: { quantity: number }) => api.post(`/clothing/variants/${id}/transfer`, data);
export const getLowStockVariants = () => api.get('/clothing/variants/low-stock');
export const getClothingStats = () => api.get('/clothing/stats');

// ── Tailoring Jobs ───────────────────────────────────────────────────────────
export const getTailoringJobs = (status?: string) => api.get('/tailoring/jobs', { params: status ? { status } : {} });
export const createTailoringJob = (data: any) => api.post('/tailoring/jobs', data);
export const getTailoringJob = (id: number) => api.get(`/tailoring/jobs/${id}`);
export const getJobByToken = (token: string) => api.get(`/tailoring/jobs/token/${token}`);
export const getJobsByPhone = (phone: string) => api.get(`/tailoring/jobs/phone/${phone}`);
export const updateTailoringStatus = (id: number, status: string) => api.patch(`/tailoring/jobs/${id}/status`, { status });
export const deliverTailoringJob = (id: number, data?: any) => api.patch(`/tailoring/jobs/${id}/deliver`, data || {});
export const getTailoringStats = () => api.get('/tailoring/stats');
