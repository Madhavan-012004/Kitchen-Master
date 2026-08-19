import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { usePOSMode } from '../context/POSModeContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useTranslation } from 'react-i18next';
import './GlobalMobileNav.css';

export default function GlobalMobileNav({ onOpenMenu }) {
    const { user, canAccess } = useAuth();
    const { isPoultry, isClothing, supermarketMode } = usePOSMode();
    const { t } = useTranslation();

    // Primary mobile quick items
    const primaryNavItems = [
        { path: 'pos', icon: '⚡', label: 'POS', section: 'pos' },
        { path: 'orders', icon: '📋', label: 'Orders', section: 'orders' },
        { path: 'inventory', icon: '📦', label: 'Inventory', section: 'inventory' },
        { path: 'customers', icon: '👥', label: 'Customers', section: 'customers' },
        { path: 'analytics', icon: '📊', label: 'Analytics', section: 'analytics' },
    ];


    // Filter by role/mode access
    const filteredItems = primaryNavItems.filter(item => {
        if (item.path === 'customers' && !user?.enableCustomerPointsPage && !isPoultry) return false;
        if (isPoultry && item.path === 'customers') return true; // poultry clients
        if (!item.section) return true;
        return canAccess(item.section);
    });

    return (
        <nav className="gmobile-bottom-nav">
            {filteredItems.slice(0, 4).map(item => {
                const targetPath = (isPoultry && item.path === 'customers') ? 'poultry-clients' : item.path;
                return (
                    <NavLink
                        key={item.path}
                        to={`/${targetPath}`}
                        className={({ isActive }) => `gmobile-nav-tab ${isActive ? 'active' : ''}`}
                    >
                        <span className="gmobile-nav-icon">{item.icon}</span>
                        <span className="gmobile-nav-label">{item.label}</span>
                    </NavLink>
                );
            })}

            <button
                className="gmobile-nav-tab gmobile-menu-tab"
                onClick={onOpenMenu}
                type="button"
            >
                <span className="gmobile-nav-icon">☰</span>
                <span className="gmobile-nav-label">Menu</span>
            </button>
        </nav>
    );
}
