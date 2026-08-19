import React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useStakeholder } from '../context/StakeholderContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { usePOSMode } from '../context/POSModeContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { useTranslation } from 'react-i18next'
import { useMaintenance, parseServerDate } from '../context/MaintenanceContext.jsx'
import { useMobileView } from '../context/MobileViewContext.jsx'
import GlobalMobileNav from './GlobalMobileNav.jsx'
import OfflineSyncBadge from './OfflineSyncBadge.jsx'
import './Layout.css'

import logo from '../assets/LOGO.jpeg'

function UpcomingMaintenanceIntimation() {
    const { upcomingBanner } = useMaintenance()
    const [timeLeftStr, setTimeLeftStr] = React.useState('')
    const [showTooltip, setShowTooltip] = React.useState(false)
    const [bannerDismissed, setBannerDismissed] = React.useState(false)

    React.useEffect(() => {
        if (!upcomingBanner?.fromTime) return
        const startsAt = parseServerDate(upcomingBanner.fromTime)
        if (!startsAt) return

        const updateCount = () => {
            const now = new Date()
            const diff = startsAt.getTime() - now.getTime()

            if (diff <= 0) {
                setTimeLeftStr('Starting now...')
            } else {
                const mins = Math.floor(diff / (1000 * 60))
                const hrs = Math.floor(mins / 60)
                const remMins = mins % 60

                if (hrs > 0) {
                    setTimeLeftStr(`in ${hrs}h ${remMins}m`)
                } else {
                    setTimeLeftStr(`in ${remMins}m`)
                }
            }
        }

        updateCount()
        const timer = setInterval(updateCount, 10000)
        return () => clearInterval(timer)
    }, [upcomingBanner])

    // If NO maintenance is scheduled/upcoming, render ABSOLUTELY NOTHING!
    if (!upcomingBanner) return null

    const startsAtDate = parseServerDate(upcomingBanner.fromTime)
    const endsAtDate = parseServerDate(upcomingBanner.toTime)

    const fromTimeStr = startsAtDate ? startsAtDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''
    const fromDateStr = startsAtDate ? startsAtDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }) : ''
    const toTimeStr = endsAtDate ? endsAtDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''
    const toDateStr = endsAtDate ? endsAtDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }) : ''

    const reasonTitle = upcomingBanner.title || 'Scheduled System Maintenance'
    const reasonDetails = upcomingBanner.message || 'The system will undergo scheduled maintenance to upgrade server cluster performance.'

    return (
        <>
            {/* Optional Slim Announcement Banner across the top if start is within 2 hours */}
            {!bannerDismissed && (
                <div style={{
                    background: 'linear-gradient(90deg, #fffbe6 0%, #fef3c7 100%)',
                    borderBottom: '1px solid #fcd34d',
                    color: '#92400e',
                    padding: '6px 16px',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    boxShadow: 'inset 0 -1px 0 rgba(245, 158, 11, 0.2)'
                }}>
                    <span style={{ fontSize: '14px' }}>⚠️</span>
                    <span>
                        <strong>Upcoming Maintenance Notice:</strong> {reasonTitle} — From: <u>{fromDateStr} {fromTimeStr}</u> To: <u>{toDateStr} {toTimeStr}</u> ({timeLeftStr})
                    </span>
                    <span
                        onClick={() => setBannerDismissed(true)}
                        style={{ cursor: 'pointer', opacity: 0.6, fontSize: '13px', marginLeft: '8px' }}
                        title="Dismiss announcement bar"
                    >✕</span>
                </div>
            )}

            {/* Top Navbar Chip */}
            <div className="upcoming-maint-intimation-wrapper" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 'auto', marginRight: '8px' }}>
                <div
                    className="upcoming-maint-chip"
                    onClick={() => setShowTooltip(!showTooltip)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(245, 158, 11, 0.12)',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        color: '#d97706',
                        padding: '5px 12px',
                        borderRadius: '20px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.15)'
                    }}
                    title="Click to view full maintenance schedule & reason"
                >
                    <span className="maint-pulse-dot" style={{
                        width: 7, height: 7, borderRadius: '50%', background: '#f59e0b',
                        boxShadow: '0 0 6px #f59e0b',
                        display: 'inline-block'
                    }} />
                    <span>⚠️ Maintenance: {fromTimeStr} - {toTimeStr} ({timeLeftStr})</span>
                </div>

                {showTooltip && (
                    <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 0,
                        width: '320px',
                        background: '#ffffff',
                        color: '#1e293b',
                        border: '1px solid #e2e8f0',
                        borderRadius: '14px',
                        padding: '16px 18px',
                        boxShadow: '0 10px 30px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.08)',
                        zIndex: 9999,
                        textAlign: 'left',
                        fontSize: '12px',
                        lineHeight: '1.5'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontWeight: 700, color: '#d97706', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                ⚠️ Scheduled Maintenance
                            </span>
                            <span style={{ cursor: 'pointer', opacity: 0.5, fontSize: '14px' }} onClick={() => setShowTooltip(false)}>✕</span>
                        </div>

                        <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '4px', fontSize: '14px' }}>
                            {reasonTitle}
                        </div>

                        <div style={{ color: '#64748b', marginBottom: '12px', fontSize: '12px', lineHeight: 1.45 }}>
                            {reasonDetails}
                        </div>

                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '11.5px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748b' }}>📅 <strong>From (Starts):</strong></span>
                                <span style={{ fontWeight: 700, color: '#0f172a' }}>{fromDateStr} at {fromTimeStr}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#64748b' }}>⏳ <strong>To (Ends):</strong></span>
                                <span style={{ fontWeight: 700, color: '#0f172a' }}>{toDateStr} at {toTimeStr}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '6px', marginTop: '2px' }}>
                                <span style={{ color: '#d97706', fontWeight: 600 }}>⏱️ <strong>Commences:</strong></span>
                                <span style={{ fontWeight: 800, color: '#d97706' }}>{timeLeftStr}</span>
                            </div>
                        </div>

                        <div style={{ marginTop: '10px', fontSize: '10.5px', color: '#94a3b8', textAlign: 'center' }}>
                            Please save any open billing work before the maintenance start time.
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}

const NAV_ITEMS = [
    { path: 'pos', icon: '🖥️', tKey: 'billing_short', section: 'pos' },
    { path: 'kitchen', icon: '👨‍🍳', tKey: 'kitchen', section: 'kitchen' },
    { path: 'billing-queue', icon: '🧾', tKey: 'billing', section: 'billing' },
    { path: 'orders', icon: '📋', tKey: 'orders', section: 'orders' },
    { path: 'menu', icon: '🍽️', tKey: 'menu', section: 'menu' },
    { path: 'employees', icon: '👥', tKey: 'staff', section: 'employees' },
    { path: 'analytics', icon: '📊', tKey: 'analytics', section: 'analytics' },
    { path: 'attendance', icon: '📍', tKey: 'attendance', section: 'attendance' },
    { path: 'ai-assistant', icon: '✨', tKey: 'assistant', section: 'assistant' },
    { path: 'inventory', icon: '📦', tKey: 'inventory', section: 'inventory' },
    { path: 'tailoring-jobs', icon: '🧵', tKey: 'tailoring', section: 'tailoring' },
    { path: 'expenditures', icon: '💰', tKey: 'expenditures', section: 'expenditures' },
    { path: 'kanban', icon: '📋', tKey: 'kanban', section: 'kanban' },
    { path: 'customers', icon: '👥', tKey: 'customers', section: 'customers' },
    { path: 'poultry-clients', icon: '👥', tKey: 'customers', section: 'pos' },
    { path: 'poultry-history', icon: '📜', tKey: 'ledger_short', section: 'pos' },
    { path: 'whatsapp', icon: '📱', tKey: 'whatsapp', section: 'whatsapp' },
    { path: 'profile', icon: '⚙️', tKey: 'settings', section: 'profile' },
]

const TOP_NAV_ITEMS = [
    { path: 'pos', tKey: 'billing_short', section: 'pos' },
    { path: 'kitchen', tKey: 'kot_short', section: 'kitchen' },
    { path: 'billing-queue', tKey: 'bill_short', section: 'billing' },
    { path: 'orders', tKey: 'history_short', section: 'orders' },
    { path: 'poultry-clients', tKey: 'customers', section: 'pos' },
    { path: 'poultry-history', tKey: 'ledger_short', section: 'pos' },
    { path: 'profile', tKey: 'settings_short', section: 'profile' }
]

const SIDE_NAV_ITEMS = [
    { path: 'orders', icon: '📋', tKey: 'orders', section: 'orders' },
    { path: 'menu', icon: '🍽️', tKey: 'menu', section: 'menu' },
    { path: 'employees', icon: '👥', tKey: 'staff', section: 'employees' },
    { path: 'analytics', icon: '📊', tKey: 'analytics', section: 'analytics' },
    { path: 'attendance', icon: '📍', tKey: 'attendance', section: 'attendance' },
    { path: 'inventory', icon: '📦', tKey: 'inventory', section: 'inventory' },
    { path: 'tailoring-jobs', icon: '✂️', tKey: 'tailoring', section: 'tailoring' },
    { path: 'expenditures', icon: '💰', tKey: 'expenditures', section: 'expenditures' },
    { path: 'kanban', icon: '📋', tKey: 'kanban', section: 'kanban' },
    { path: 'customers', icon: '👥', tKey: 'customers', section: 'customers' },
    { path: 'poultry-clients', icon: '👥', tKey: 'customers', section: 'pos' },
    { path: 'poultry-history', icon: '📜', tKey: 'ledger_short', section: 'pos' },
    { path: 'whatsapp', icon: '📱', tKey: 'whatsapp', section: 'whatsapp' },
    { path: 'ai-assistant', icon: '🤖', tKey: 'assistant', section: 'assistant' },
]


// ─── License Expiry Banner ────────────────────────────────────────────────────
function LicenseExpiryBanner({ user, t }) {
    const [dismissed, setDismissed] = React.useState(false)

    if (dismissed) return null
    if (!user || user.isProBloomAdmin) return null

    // Only owner sees the banner (employees inherit owner's license)
    if (user.role !== 'owner') return null

    const expiresAt = user._licenseExpiresAt || user.subscription?.expiresAt
    if (!expiresAt) return null

    const daysLeft = Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24))
    if (daysLeft > 30) return null

    const isCritical = daysLeft <= 7
    const expDate = new Date(expiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

    return (
        <div className={`pb-expiry-banner ${isCritical ? 'pb-expiry-banner--critical' : 'pb-expiry-banner--warning'}`}>
            <span>{isCritical ? '🔴' : '⚠️'}</span>
            <span>
                {daysLeft <= 0
                    ? t('license.expired')
                    : t('license.expiring_in', { days: daysLeft, date: expDate })
                }
                <strong>{t('license.contact_support')}</strong>
            </span>
            <span
                onClick={() => setDismissed(true)}
                style={{ marginLeft: '12px', cursor: 'pointer', opacity: 0.6, fontSize: '0.9rem' }}
                title="Dismiss"
            >✕</span>
        </div>
    )
}

export default function Layout() {
    const { user, logout, canAccess, attendance, checkIn, checkOut } = useAuth()
    const { accessibleRestaurants, selectedRestaurantId, selectRestaurant } = useStakeholder()
    const { theme, toggleTheme } = useTheme()
    const { supermarketMode, toggleSupermarketMode, isClothing, isMarket, cycleMode, isPoultry, isRestaurant } = usePOSMode()
    const { itemNameLanguage, setItemNameLanguage } = useLanguage()
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const [loading, setLoading] = React.useState(false)
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)
    const [showProfileMenu, setShowProfileMenu] = React.useState(false)
    const profileRef = React.useRef(null)

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setShowProfileMenu(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    React.useEffect(() => {
        setIsSidebarOpen(false)
    }, [navigate])

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen)

    const handleAttendanceAction = async () => {
        setLoading(true)
        if (attendance.isActive) {
            const res = await checkOut()
            if (!res.success) alert(res.message)
        } else {
            if (!navigator.geolocation) {
                alert('Geolocation is not supported by your browser')
                setLoading(false)
                return
            }
            navigator.geolocation.getCurrentPosition(async (pos) => {
                const res = await checkIn(pos.coords.latitude, pos.coords.longitude)
                if (!res.success) alert(res.message)
                setLoading(false)
            }, () => {
                alert('Failed to get location. Please enable GPS.')
                setLoading(false)
            })
            return
        }
        setLoading(false)
    }

    const handleLogout = async () => {
        await logout()
        navigate('/login')
    }

    const { isMobileView } = useMobileView()

    return (
        <div className={`layout ${isSidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'} ${isMobileView ? 'global-mobile-layout' : ''}`}>

            {/* ── ProBloom License Expiry Banner ── */}
            <LicenseExpiryBanner user={user} t={t} />

            {/* TOP BAR */}
            <header className="top-bar">
                <div className="top-bar-left">
                    <button className="sidebar-toggle-btn" onClick={toggleSidebar}>
                        {isSidebarOpen ? '✕' : '☰'}
                    </button>
                    <div className="header-logo">
                        <img src={user?.logo || logo} alt="Logo" className="header-logo-img" />
                        <span className="header-brand-name"><span style={{ color: 'var(--accent)' }}>P</span>ro<span style={{ color: 'var(--accent)' }}>B</span>loom</span>
                    </div>
                </div>
                <div className="top-bar-center">
                    {TOP_NAV_ITEMS.filter(item => {
                        if (!isClothing && item.section === 'tailoring') return false;
                        if ((supermarketMode || isClothing || isPoultry) && item.section === 'kitchen') return false;
                        if ((supermarketMode || isClothing || isPoultry) && item.section === 'billing') return false;
                        if (!isPoultry && item.path === 'poultry-clients') return false;
                        if (!isPoultry && item.path === 'poultry-history') return false;
                        return !item.section || canAccess(item.section);
                    }).map(item => (
                        <NavLink
                            key={item.path}
                            to={`/${item.path}`}
                            className={({ isActive }) => `top-nav-item ${isActive ? 'active' : ''}`}
                            title={t(`nav.${item.tKey}`)}
                        >
                            <span className="top-nav-label">{t(`nav.${item.tKey}`)}</span>
                        </NavLink>
                    ))}
                </div>
                <div className="top-bar-right">
                    {/* UNIVERSAL OFFLINE SYNC STATUS BADGE */}
                    <OfflineSyncBadge />

                    {/* UPCOMING MAINTENANCE INTIMATION CHIP (Renders ONLY when maintenance is scheduled) */}
                    <UpcomingMaintenanceIntimation />

                    {/* PREMIUM SEGMENTED LANGUAGE CONTROL */}
                    <div className="premium-lang-switcher" title={itemNameLanguage === 'ta' ? 'Names: English' : 'பெயர்: தமிழ்'}>
                        <div className={`lang-segment ${itemNameLanguage === 'en' ? 'active' : ''}`} onClick={() => setItemNameLanguage('en')}>
                            ENG
                        </div>
                        <div className={`lang-segment ${itemNameLanguage === 'ta' ? 'active' : ''}`} onClick={() => setItemNameLanguage('ta')}>
                            தமிழ்
                        </div>
                        <div className={`lang-slider ${itemNameLanguage}`} />
                    </div>

                    <button
                        className="header-theme-toggle-btn"
                        onClick={toggleTheme}
                        title={t('common.switch_to_mode', { mode: theme === 'dark' ? t('settings.light_mode') : t('settings.dark_mode') })}
                    >
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                    <div className="header-user-wrapper" ref={profileRef}>
                        <button
                            className={`header-user-info-btn ${showProfileMenu ? 'active' : ''}`}
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                        >
                            <span className="header-user-name">{user?.name}</span>
                            <div className="header-avatar">
                                {user?.logo ? (
                                    <img src={user.logo} alt="user" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                ) : (
                                    user?.name?.charAt(0).toUpperCase()
                                )}
                            </div>
                        </button>

                        {showProfileMenu && (
                            <div className="profile-dropdown animate-fade-in">
                                <div className="profile-dropdown-header">
                                    <div className="dropdown-avatar-large">
                                        {user?.logo ? (
                                            <img src={user.logo} alt="user" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                            user?.name?.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <div className="dropdown-user-details">
                                        <div className="dropdown-user-name">{user?.name}</div>
                                        <div className="dropdown-user-email">{user?.email}</div>
                                        <div className="dropdown-user-role-badge">
                                            {t(`role.${user?.role?.toLowerCase()}`)}
                                        </div>
                                    </div>
                                </div>

                                <div className="profile-dropdown-body">
                                    <button className="dropdown-item" onClick={() => { navigate('/profile'); setShowProfileMenu(false); }}>
                                        <span className="dropdown-item-icon">⚙️</span>
                                        {t('common.manage_profile')}
                                    </button>
                                </div>

                                <div className="profile-dropdown-footer">
                                    <button className="dropdown-logout-btn" onClick={handleLogout}>
                                        ↪ {t('common.sign_out')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* MINI NAV BAR (Left Vertical Bar) */}
            <aside className="mini-side-bar">
                {SIDE_NAV_ITEMS.filter(item => {
                    if (item.path === 'customers' && !user?.enableCustomerPointsPage) return false;
                    if (isPoultry && item.path === 'customers') return false; // Hide regular customers page in poultry mode
                    if (!isPoultry && item.path === 'poultry-clients') return false;
                    if (!isPoultry && item.path === 'poultry-history') return false;
                    if (!isClothing && item.section === 'tailoring') return false;
                    if ((supermarketMode || isClothing) && item.section === 'menu') return false;
                    if ((supermarketMode || isClothing || isPoultry) && item.section === 'billing') return false;
                    if (isPoultry && item.section === 'kitchen') return false;
                    return !item.section || canAccess(item.section);
                }).map(item => (
                    <NavLink
                        key={item.path}
                        to={`/${item.path}`}
                        className={({ isActive }) => `mini-nav-item ${isActive ? 'active' : ''}`}
                        title={t(`nav.${item.tKey}`)}
                    >
                        <span className="mini-nav-icon">{item.icon}</span>
                    </NavLink>
                ))}
            </aside>

            {/* OVERLAY FOR MOBILE/DRAWER */}
            {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />}

            {/* SIDEBAR */}
            <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <nav className="sidebar-nav">
                    {NAV_ITEMS.filter(item => {
                        if (item.path === 'customers' && !user?.enableCustomerPointsPage) return false;
                        if (isPoultry && item.path === 'customers') return false; // Hide regular customers page in poultry mode
                        if (!isPoultry && item.path === 'poultry-clients') return false;
                        if (!isPoultry && item.path === 'poultry-history') return false;
                        if (!isClothing && item.section === 'tailoring') return false;
                        if ((supermarketMode || isClothing) && item.section === 'menu') return false;
                        if ((supermarketMode || isClothing || isPoultry) && item.section === 'billing') return false;
                        if ((supermarketMode || isClothing || isPoultry) && item.section === 'kitchen') return false;
                        // Items without a section (profile, ai-assistant) are always accessible
                        if (!item.section) return true;
                        return canAccess(item.section);
                    }).map(item => (
                        <NavLink
                            key={item.path}
                            to={`/${item.path}`}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span className="nav-label">{t(`nav.${item.tKey}`)}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
                        <div className="sidebar-avatar">
                            {user?.logo ? (
                                <img src={user.logo} alt="user" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                                user?.name?.charAt(0)?.toUpperCase()
                            )}
                        </div>
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-name">{user?.name}</div>
                            <div className="sidebar-user-role">{user?.role?.toUpperCase()}</div>
                        </div>
                    </div>

                    {user?.role !== 'owner' && isRestaurant && (
                        <button
                            className={`attendance-action-btn ${attendance.isActive ? 'active' : ''}`}
                            onClick={handleAttendanceAction}
                            disabled={loading}
                        >
                            {loading ? 'Processing...' : (attendance.isActive ? '🚩 Finish Shift (Check Out)' : '📍 Start Shift (Check In)')}
                        </button>
                    )}

                    <button className="sidebar-logout-btn" onClick={handleLogout}>
                        ↪ {t('common.sign_out')}
                    </button>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="main-content">
                <Outlet />
            </main>

            {/* GLOBAL MOBILE BOTTOM NAVIGATION BAR */}
            <GlobalMobileNav onOpenMenu={() => setIsSidebarOpen(true)} />
        </div>
    )
}
