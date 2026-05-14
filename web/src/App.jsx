import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { StakeholderProvider } from './context/StakeholderContext.jsx'
import LoginPage from './pages/Login.jsx'
import { ThemeProvider, useTheme } from './context/ThemeContext.jsx'
import { POSModeProvider, usePOSMode } from './context/POSModeContext.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'
import { NetworkProvider, useNetwork, setGlobalTriggerOffline } from './context/NetworkContext.jsx'
import NetworkErrorOverlay from './components/NetworkErrorOverlay.jsx'
import Layout from './components/Layout.jsx'
import POSPage from './pages/POS.jsx'
import OrdersPage from './pages/Orders.jsx'
import MenuPage from './pages/Menu.jsx'
import EmployeesPage from './pages/Employees.jsx'
import AnalyticsPage from './pages/Analytics.jsx'
import AttendancePage from './pages/Attendance.jsx'
import ProfilePage from './pages/Profile.jsx'
import KitchenPage from './pages/Kitchen.jsx'
import BillingQueue from './pages/BillingQueue.jsx'
import CustomerMenu from './pages/CustomerMenu.jsx'
import AIAssistant from './pages/AIAssistant.jsx'
import InventoryPage from './pages/Inventory.jsx'
import ExpendituresPage from './pages/Expenditures.jsx'
import ProjectTracker from './pages/ProjectTracker.jsx'
import MasterBackoffice from './pages/MasterBackoffice.jsx'
import ProBloomProvisionClient from './pages/ProBloomProvisionClient.jsx'
import WaitlistRegistration from './pages/WaitlistRegistration.jsx'
import WaitlistMonitor from './pages/WaitlistMonitor.jsx'
import LicenseManagement from './pages/LicenseManagement.jsx'
import api from './api/client.js'

// ─── Guards ───────────────────────────────────────────────────────────────────

function ProtectedRoute({ children, section }) {
  const { isAuthenticated, canAccess, user } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.isProBloomAdmin) return <Navigate to="/probloom-hq" replace />
  // Stakeholders go to analytics as their home
  if (user?.role === 'stakeholder' && section && !['analytics', 'attendance', 'inventory', 'employees', 'orders', 'menu'].includes(section)) {
    return <Navigate to="/analytics" replace />
  }
  if (section && user?.role !== 'stakeholder' && !canAccess(section)) return <Navigate to="/pos" replace />
  return children
}

// Guard: only the ProBloom Super Admin can access /probloom-hq
function ProBloomAdminRoute({ children }) {
  const { isAuthenticated, user } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user?.isProBloomAdmin) return <Navigate to="/pos" replace />
  return children
}

// ─── Theme Sync ─────────────────────────────────────────────────────────────────
// Syncs the authenticated user's setting with the context
function ThemeSync() {
  const { user } = useAuth();
  const { updateAccentColor, accentColor } = useTheme();

  React.useEffect(() => {
    if (user && user.accentColor && user.accentColor !== accentColor) {
      updateAccentColor(user.accentColor);
    }
  }, [user?.accentColor]);

  return null;
}

function POSModeSync() {
  const { user } = useAuth();
  const { setSupermarketMode, supermarketMode } = usePOSMode();

  React.useEffect(() => {
    if (user && user.preferredPosMode) {
      const shouldBeMarket = user.preferredPosMode === 'supermarket';
      if (shouldBeMarket !== supermarketMode) {
        setSupermarketMode(shouldBeMarket);
      }
    }
  }, [user?.preferredPosMode, supermarketMode, setSupermarketMode]);

  return null;
}

// ─── Network Global Bridge ───────────────────────────────────────────────────────
// Connects the React NetworkContext to the Axios singleton (non-React)
function NetworkGlobalBridge() {
  const { triggerOffline } = useNetwork();
  React.useEffect(() => {
    setGlobalTriggerOffline(triggerOffline);
  }, [triggerOffline]);
  return null;
}

// ─── License Warning Banner ──────────────────────────────────────────────────────
// Shown across all authenticated pages when the license is expiring soon or missing
function LicenseWarningBanner() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [licenseWarn, setLicenseWarn] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  // Public pages that don't need the banner
  const isPublicPage = ['/login', '/license'].some(p => location.pathname.startsWith(p)) ||
    location.pathname.startsWith('/menu/') ||
    location.pathname.startsWith('/join-waitlist/') ||
    location.pathname.startsWith('/waitlist-monitor/');

  useEffect(() => {
    if (!isAuthenticated || isPublicPage || user?.isProBloomAdmin) return;
    let cancelled = false;
    api.get('license/status').then(res => {
      if (cancelled) return;
      const s = res.data;
      if (!s.valid) {
        setLicenseWarn({ type: 'error', message: s.message || 'License invalid. Go to License Management to fix.', status: s.status });
      } else if (s.daysLeft != null && s.daysLeft <= 30) {
        setLicenseWarn({ type: 'warning', message: `Your license expires in ${s.daysLeft} day${s.daysLeft !== 1 ? 's' : ''}. Please renew soon.` });
      } else {
        setLicenseWarn(null);
      }
    }).catch(() => { /* silent fail - backend might be online-only */ });
    return () => { cancelled = true; };
  }, [isAuthenticated, location.pathname]);

  if (!licenseWarn || dismissed || isPublicPage) return null;

  const bannerStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
    padding: '0.6rem 1.2rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem',
    fontSize: '0.85rem', fontWeight: 600, fontFamily: 'Inter, sans-serif',
    background: licenseWarn.type === 'error'
      ? 'linear-gradient(90deg, #7f1d1d, #991b1b)'
      : 'linear-gradient(90deg, #78350f, #92400e)',
    color: licenseWarn.type === 'error' ? '#fca5a5' : '#fcd34d',
    borderBottom: `1px solid ${licenseWarn.type === 'error' ? '#ef444440' : '#f59e0b40'}`,
    boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
  };

  return (
    <div style={bannerStyle} id="license-warning-banner">
      <span>{licenseWarn.type === 'error' ? '🔒' : '⚠️'} {licenseWarn.message}</span>
      <button
        id="btn-goto-license"
        onClick={() => navigate('/license')}
        style={{
          padding: '0.3rem 0.8rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
          background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: '0.8rem', fontWeight: 700,
        }}
      >Manage License</button>
      <button
        id="btn-dismiss-license-warn"
        onClick={() => setDismissed(true)}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.5)', fontSize: '1rem', lineHeight: 1,
        }}
      >✕</button>
    </div>
  );
}

export default function App() {
  return (
    <NetworkProvider>
      <ThemeProvider>
        <LanguageProvider>
        <POSModeProvider>
          <AuthProvider>
            <StakeholderProvider>
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <ThemeSync />
                <POSModeSync />
                <LicenseWarningBanner />
                <Routes>
                  {/* Public */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/license" element={<LicenseManagement />} />
                  <Route path="/menu/:restaurantId/:tableNumber" element={<CustomerMenu />} />
                  <Route path="/join-waitlist/:restaurantId" element={<WaitlistRegistration />} />
                  <Route path="/waitlist-monitor/:restaurantId" element={<WaitlistMonitor />} />
                  <Route path="/waitlist-monitor/:restaurantId/" element={<WaitlistMonitor />} />

                  {/* ── ProBloom HQ — Secret Master Admin Dashboard ── */}
                  <Route
                    path="/probloom-hq"
                    element={
                      <ProBloomAdminRoute>
                        <MasterBackoffice />
                      </ProBloomAdminRoute>
                    }
                  />
                  <Route
                    path="/probloom-hq/provision"
                    element={
                      <ProBloomAdminRoute>
                        <ProBloomProvisionClient />
                      </ProBloomAdminRoute>
                    }
                  />

                  {/* ── Kitchen Master App (for restaurant clients) ── */}
                  <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route index element={<Navigate to="/pos" replace />} />
                    <Route path="pos" element={<ProtectedRoute section="pos"><POSPage /></ProtectedRoute>} />
                    <Route path="orders" element={<ProtectedRoute section="orders"><OrdersPage /></ProtectedRoute>} />
                    <Route path="menu" element={<ProtectedRoute section="menu"><MenuPage /></ProtectedRoute>} />
                    <Route path="employees" element={<ProtectedRoute section="employees"><EmployeesPage /></ProtectedRoute>} />
                    <Route path="kitchen" element={<ProtectedRoute section="kitchen"><KitchenPage /></ProtectedRoute>} />
                    <Route path="billing-queue" element={<ProtectedRoute section="billing"><BillingQueue /></ProtectedRoute>} />
                    <Route path="analytics" element={<ProtectedRoute section="analytics"><AnalyticsPage /></ProtectedRoute>} />
                    <Route path="attendance" element={<ProtectedRoute section="attendance"><AttendancePage /></ProtectedRoute>} />
                    <Route path="ai-assistant" element={<ProtectedRoute><AIAssistant /></ProtectedRoute>} />
                    <Route path="inventory" element={<ProtectedRoute section="inventory"><InventoryPage /></ProtectedRoute>} />
                    <Route path="expenditures" element={<ProtectedRoute section="expenditures"><ExpendituresPage /></ProtectedRoute>} />
                    <Route path="kanban" element={<ProtectedRoute><ProjectTracker /></ProtectedRoute>} />
                    <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                  </Route>

                  <Route path="*" element={<Navigate to="/pos" replace />} />
                </Routes>
              </BrowserRouter>
            </StakeholderProvider>
          </AuthProvider>
        </POSModeProvider>
      </LanguageProvider>
    </ThemeProvider>
    {/* Network Error Overlay — above all routes, outside Router */}
    <NetworkGlobalBridge />
    <NetworkErrorOverlay />
  </NetworkProvider>
  )
}
