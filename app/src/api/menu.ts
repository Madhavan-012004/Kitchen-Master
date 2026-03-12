import apiClient from './client';

export const menuAPI = {
    getAll: (params?: { category?: string; available?: boolean; page?: number }) =>
        apiClient.get('/menu', { params }),

    getOne: (id: string) => apiClient.get(`/menu/${id}`),

    create: (data: any) => apiClient.post('/menu', data),

    update: (id: string, data: any) => apiClient.put(`/menu/${id}`, data),

    delete: (id: string) => apiClient.delete(`/menu/${id}`),

    bulkCreate: (items: any[]) => apiClient.post('/menu/bulk', { items }),

    toggleAvailability: (id: string) => apiClient.patch(`/menu/${id}/toggle`),
};
