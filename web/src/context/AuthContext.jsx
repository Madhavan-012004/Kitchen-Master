import React, { createContext, useContext, useState } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem('km_user')) } catch { return null }
    })
    const [token, setToken] = useState(() => sessionStorage.getItem('km_token') || null)
    const [attendance, setAttendance] = useState({ isActive: false, checkInTime: null })

    const fetchAttendanceStatus = async () => {
        if (!token || user?.role === 'owner' || user?.role === 'stakeholder') return
        try {
            const res = await api.get('/attendance/status')
            if (res.data.success && res.data.data.isCheckedIn) {
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
        if (attendance.isActive && navigator.geolocation) {
            interval = setInterval(() => {
                navigator.geolocation.getCurrentPosition(async (pos) => {
                    try {
                        const res = await api.post('/attendance/ping', {
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude
                        })
                        // If auto-disconnected by backend
                        if (!res.data.success) {
                            setAttendance({ isActive: false, checkInTime: null })
                        }
                    } catch (err) {
                        if (err.response?.status === 403) {
                            setAttendance({ isActive: false, checkInTime: null })
                        }
                    }
                })
            }, 120000) // Ping every 2 mins
        }
        return () => clearInterval(interval)
    }, [attendance.isActive])

    const login = (userData, authToken) => {
        if (userData && userData.role) userData.role = userData.role.toLowerCase()
        setUser(userData)
        setToken(authToken)
        sessionStorage.setItem('km_user', JSON.stringify(userData))
        sessionStorage.setItem('km_token', authToken)
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
        sessionStorage.removeItem('km_user')
        sessionStorage.removeItem('km_token')
    }

    const updateUser = (userData) => {
        if (userData && userData.role) userData.role = userData.role.toLowerCase()
        setUser(userData)
        sessionStorage.setItem('km_user', JSON.stringify(userData))
    }

    const isAuthenticated = !!token && !!user

    // Role checks
    const canAccess = (section) => {
        if (!user) return false
        const role = user.role || 'owner'
        if (role === 'stakeholder') {
            // Investors/Stakeholders can see management views but are usually restricted from editing depending on specific page logic
            return ['analytics', 'inventory', 'menu', 'orders', 'employees'].includes(section)
        }
        if (role === 'owner' || role === 'manager') return true
        if (section === 'attendance') return false 
        if (section === 'kitchen') return ['owner', 'manager', 'kitchen'].includes(role)
        if (role === 'biller') return ['pos', 'orders', 'billing'].includes(section)
        if (role === 'waiter') return ['pos', 'orders', 'menu'].includes(section)
        if (role === 'kitchen') return ['orders'].includes(section)
        if (role === 'inventory') return ['menu', 'orders', 'inventory'].includes(section)
        if (section === 'billing') return ['owner', 'manager', 'biller'].includes(role)
        return false
    }

    const checkIn = async (latitude, longitude) => {
        try {
            const res = await api.post('/attendance/checkin', { latitude, longitude })
            if (res.data.success) {
                setAttendance({ isActive: true, checkInTime: res.data.data.record.checkInTime })
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
