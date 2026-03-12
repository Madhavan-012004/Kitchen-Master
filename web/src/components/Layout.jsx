import React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import './Layout.css'

const NAV_ITEMS = [
    { path: 'pos', icon: '🖥️', label: 'POS / Billing', section: 'pos' },
    { path: 'kitchen', icon: '👨‍🍳', label: 'Kitchen Display', section: 'kitchen' },
    { path: 'billing-queue', icon: '🧾', label: 'Bill Printing', section: 'billing' },
    { path: 'orders', icon: '📋', label: 'Order History', section: 'orders' },
    { path: 'menu', icon: '🍽️', label: 'Menu', section: 'menu' },
    { path: 'employees', icon: '👥', label: 'Staff', section: 'employees' },
    { path: 'analytics', icon: '📊', label: 'Analytics', section: 'analytics' },
    { path: 'attendance', icon: '📍', label: 'Attendance', section: 'attendance' },
]

export default function Layout() {
    const { user, logout, canAccess } = useAuth()
    const { theme, toggleTheme } = useTheme()
    const navigate = useNavigate()

    const handleLogout = async () => {
        await logout()
        navigate('/login')
    }

    return (
        <div className="layout">
            {/* SIDEBAR */}
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <span className="sidebar-logo">🍳</span>
                    <div>
                        <div className="sidebar-name">Kitchen Master</div>
                        <div className="sidebar-sub">POS Desktop</div>
                    </div>
                </div>

                <div className="sidebar-theme-toggle">
                    <button onClick={toggleTheme} className="theme-toggle-btn" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
                        {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {NAV_ITEMS.filter(item => canAccess(item.section)).map(item => (
                        <NavLink
                            key={item.path}
                            to={`/${item.path}`}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span className="nav-label">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
                        <div className="sidebar-avatar">{user?.name?.charAt(0)?.toUpperCase()}</div>
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-name">{user?.name}</div>
                            <div className="sidebar-user-role">{user?.role?.toUpperCase()}</div>
                        </div>
                    </div>
                    <button className="logout-btn" onClick={handleLogout}>
                        ↪ Sign Out
                    </button>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    )
}
