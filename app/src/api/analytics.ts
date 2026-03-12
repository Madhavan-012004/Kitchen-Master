import apiClient from './client';

export const analyticsAPI = {
    getSales: (period?: '1d' | '7d' | '30d' | '90d') =>
        apiClient.get('/analytics/sales', { params: { period } }),

    getLowStock: () => apiClient.get('/analytics/low-stock'),
};

export const aiAPI = {
    parseVoiceOrder: (text: string) =>
        apiClient.post('/ai/voice-kot', { text }),

    getUpsellSuggestions: (cartItems: any[]) =>
        apiClient.post('/ai/upsell', { cartItems }),

    getInventoryForecast: () => apiClient.get('/ai/inventory-forecast'),

    digitizeMenu: (formData: FormData) =>
        apiClient.post('/ai/menu-digitizer', formData, {
            timeout: 60000, // Increase timeout for AI processing
        }),
};
