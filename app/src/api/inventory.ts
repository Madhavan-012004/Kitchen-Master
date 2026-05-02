import apiClient from './client';

export const inventoryAPI = {
    getAll: (params?: { lowStock?: boolean; page?: number; category?: string }) =>
        apiClient.get('/inventory', { params }),

    getOne: (id: string) => apiClient.get(`/inventory/${id}`),

    create: (data: any) => apiClient.post('/inventory', data),

    update: (id: string, data: any) => apiClient.put(`/inventory/${id}`, data),

    delete: (id: string) => apiClient.delete(`/inventory/${id}`),

    getMovements: () => apiClient.get('/inventory/movements'),

    adjustStock: (id: string, data: { type: string; quantity: number; reason: string; totalCost?: number; recordAsExpense?: boolean }) =>
        apiClient.post(`/inventory/${id}/adjust`, data),
};
