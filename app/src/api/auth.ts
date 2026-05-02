import apiClient from './client';

export const authAPI = {
    register: (data: {
        name: string;
        email: string;
        password: string;
        restaurantName: string;
        phone?: string;
        address?: string;
        latitude?: number;
        longitude?: number;
    }) => apiClient.post('/auth/register', data),

    login: (email: string, password: string, latitude?: number, longitude?: number) =>
        apiClient.post('/auth/login', { email, password, latitude, longitude }),

    getMe: () => apiClient.get('/auth/me'),

    updateProfile: (data: any) => apiClient.put('/auth/profile', data),

    completeOnboarding: (step: number, data: any) =>
        apiClient.post('/auth/onboarding', { step, data }),

    registerEmployee: (data: {
        name: string;
        email: string;
        password: string;
        role: string;
    }) => apiClient.post('/auth/employee/register', data),

    getEmployees: () => apiClient.get('/auth/employees'),

    updateEmployee: (id: string, data: any) => apiClient.put(`/auth/employee/${id}`, data),

    // Stakeholder Endpoints
    stakeholderLogin: (phone: string, password: string, latitude?: number, longitude?: number) =>
        apiClient.post('/stakeholder/login', { phone, password, latitude, longitude }),
        
    getAccessibleRestaurants: () => apiClient.get('/stakeholder/restaurants'),
    
    inviteStakeholder: (data: { name: string; phone: string; sharePercentage: number; password?: string }) => 
        apiClient.post('/stakeholder/invite', data),
        
    removeStakeholder: (stakeholderId: string) => 
        apiClient.post('/stakeholder/remove', { stakeholderId }),
};
