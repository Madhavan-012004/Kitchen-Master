import apiClient from './client';

export const ordersAPI = {
    getAll: (params?: { status?: string; date?: string; page?: number; tableNumber?: string }) =>
        apiClient.get('/orders', { params }),

    getOne: (id: string) => apiClient.get(`/orders/${id}`),

    create: (data: any) => apiClient.post('/orders', data),

    updateStatus: (id: string, status: string, extra?: { paymentMethod?: string; paymentStatus?: string }) =>
        apiClient.patch(`/orders/${id}/status`, { status, ...extra }),

    syncOffline: (orders: any[]) =>
        apiClient.post('/orders/sync-offline', { orders }),

    splitOrder: (id: string, itemIds: string[], newTableNumber: string) =>
        apiClient.post(`/orders/${id}/split`, { itemIds, newTableNumber }),

    combineOrders: (id: string, targetOrderId: string) =>
        apiClient.post(`/orders/${id}/combine`, { targetOrderId }),
};
