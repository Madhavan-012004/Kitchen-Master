import apiClient from './client';

export const attendanceAPI = {
    ping: (latitude: number, longitude: number) =>
        apiClient.post('/attendance/ping', { latitude, longitude }),

    checkIn: (latitude: number, longitude: number) =>
        apiClient.post('/attendance/checkin', { latitude, longitude }),

    checkOut: () =>
        apiClient.post('/attendance/checkout'),

    getStatus: () =>
        apiClient.get('/attendance/status'),

    getActive: () =>
        apiClient.get('/attendance/active'),

    getHistory: (date?: string, employeeId?: string) =>
        apiClient.get('/attendance', { params: { date, employeeId } }),
};
