import React, { createContext, useContext, useState } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem('km_user')) } catch { return null }
    })
    const [token, setToken] = useState(() => localStorage.getItem('km_token') || null)

    const login = (userData, authToken) => {
        setUser(userData)
        setToken(authToken)
        localStorage.setItem('km_user', JSON.stringify(userData))
        localStorage.setItem('km_token', authToken)
    }

    const logout = async () => {
        try {
            await api.post('/attendance/checkout')
        } catch (err) {
            console.log('Attendance checkout error:', err)
        }
        setUser(null)
        setToken(null)
        localStorage.removeItem('km_user')
        localStorage.removeItem('km_token')
    }

    const updateUser = (userData) => {
        setUser(userData)
        localStorage.setItem('km_user', JSON.stringify(userData))
    }

    const isAuthenticated = !!token && !!user

    // Role checks
    const canAccess = (section) => {
        if (!user) return false
        const role = user.role || 'owner'
        if (role === 'owner' || role === 'manager') return true
        if (section === 'attendance') return false // Only owner/manager
        if (section === 'kitchen') return ['owner', 'manager', 'kitchen'].includes(role)
        if (role === 'biller') return ['pos', 'orders', 'billing'].includes(section)
        if (role === 'waiter') return ['pos', 'orders', 'menu'].includes(section)
        if (role === 'kitchen') return ['orders'].includes(section)
        if (role === 'inventory') return ['menu', 'orders'].includes(section)
        if (section === 'billing') return ['owner', 'manager', 'biller'].includes(role)
        return false
    }

    return (
        <AuthContext.Provider value={{ user, token, isAuthenticated, login, logout, canAccess, updateUser }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
