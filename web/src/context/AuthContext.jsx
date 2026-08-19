import React, { createContext, useContext, useState } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem('km_user')) } catch { return null }
    })
    const [token, setToken] = useState(() => localStorage.getItem('km_token') || null)
    const [attendance, setAttendance] = useState({ isActive: false, checkInTime: null })

    const fetchAttendanceStatus = async () => {
        // Skip all API calls while the system is under maintenance
        if (localStorage.getItem('km_maintenance_active') === 'true') return
        if (!token || user?.role === 'owner' || user?.role === 'stakeholder') return
        try {
            const res = await api.get('/attendance/status')
            if (res.data.success && res.data.data.isActive) {
                setAttendance({
                    isActive: true,
                    checkInTime: res.data.data.checkInTime
                })
            } else {
                setAttendance({ isActive: false, checkInTime: null })
            }
        } catch (err) {
            console.error('Failed to fetch attendance status:', err)
        }
    }

    React.useEffect(() => {
        fetchAttendanceStatus()
    }, [token, user])

    React.useEffect(() => {
        let interval
        // Do not start geolocation ping during maintenance
        if (localStorage.getItem('km_maintenance_active') === 'true') return
        if (attendance.isActive && navigator.geolocation) {
            interval = setInterval(() => {
                // Re-check maintenance flag on each tick too
                if (localStorage.getItem('km_maintenance_active') === 'true') return
                navigator.geolocation.getCurrentPosition(async (pos) => {
                    try {
                        const res = await api.post('/attendance/ping', {
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude
                        })
                        if (!res.data.success) {
                            setAttendance({ isActive: false, checkInTime: null })
                        }
                    } catch (err) {
                        if (err.response?.status === 403) {
                            setAttendance({ isActive: false, checkInTime: null })
                        }
                    }
                })
            }, 120000)
        }
        return () => clearInterval(interval)
    }, [attendance.isActive])

    const login = (userData, authToken) => {
        if (userData && userData.role) userData.role = userData.role.toLowerCase()
        setUser(userData)
        setToken(authToken)
        localStorage.setItem('km_user', JSON.stringify(userData))
        localStorage.setItem('km_token', authToken)
    }

    const logout = async () => {
        try {
            if (attendance.isActive) {
                await api.post('/attendance/checkout')
            }
            await api.post('/attendance/checkout') // Legacy call just in case
        } catch (err) {
            console.log('Logout attendance error:', err)
        }
        setUser(null)
        setToken(null)
        setAttendance({ isActive: false, checkInTime: null })
        localStorage.removeItem('km_user')
        localStorage.removeItem('km_token')
    }

    const updateUser = (userData) => {
        if (userData && userData.role) userData.role = userData.role.toLowerCase()
        setUser(userData)
        localStorage.setItem('km_user', JSON.stringify(userData))
    }

    const isAuthenticated = !!token && !!user

    // Role checks
    const canAccess = (section) => {
        if (!user) return false;
        const role = user.role || 'owner';

        // Allow attendance for non-billers (so they can check in/out if required)
        if (section === 'attendance' && role !== 'biller') return true;

        if (role === 'owner' || role === 'manager') return true;

        if (role === 'stakeholder') {
            return ['analytics', 'inventory', 'menu', 'orders', 'employees'].includes(section);
        }

        // Lock everything except attendance if shift is not active (Enforced ONLY for Restaurant POS employees)
        const currentStoreMode = localStorage.getItem('storeMode') || 'restaurant';
        const isRestaurant = currentStoreMode === 'restaurant';
        if (isRestaurant && !attendance.isActive && section !== 'attendance') {
            return false;
        }

        if (role === 'waiter') return ['waiter-dashboard', 'pos', 'orders', 'menu'].includes(section);
        if (role === 'kot' || role === 'kitchen') return ['orders', 'kitchen', 'menu'].includes(section);
        if (role === 'biller') return ['pos', 'billing', 'billing-queue', 'inventory', 'customers', 'poultry-clients', 'poultry-history', 'profile'].includes(section);
        if (role === 'inventory') return ['inventory', 'expenditures', 'orders', 'menu'].includes(section);
        if (role === 'tailor') return ['tailoring'].includes(section);

        return false;
    }


    const checkIn = async (latitude, longitude) => {
        try {
            const res = await api.post('/attendance/checkin', { latitude, longitude })
            if (res.data.success) {
                setAttendance({ isActive: true, checkInTime: res.data.data.checkInTime })
                return { success: true }
            }
        } catch (err) {
            return { success: false, message: err.response?.data?.message || 'Check-in failed' }
        }
    }

    const checkOut = async () => {
        try {
            const res = await api.post('/attendance/checkout')
            if (res.data.success) {
                setAttendance({ isActive: false, checkInTime: null })
                return { success: true }
            }
        } catch (err) {
            return { success: false, message: err.response?.data?.message || 'Check-out failed' }
        }
    }

    return (
        <AuthContext.Provider value={{
            user, token, isAuthenticated, attendance,
            login, logout, canAccess, updateUser, checkIn, checkOut
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
