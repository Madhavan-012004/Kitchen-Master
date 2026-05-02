import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { StakeholderProvider } from './context/StakeholderContext.jsx'
import LoginPage from './pages/Login.jsx'
import { ThemeProvider, useTheme } from './context/ThemeContext.jsx'
import { POSModeProvider } from './context/POSModeContext.jsx'
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
import MasterBackoffice from './pages/MasterBackoffice.jsx'
import ProBloomProvisionClient from './pages/ProBloomProvisionClient.jsx'
import WaitlistRegistration from './pages/WaitlistRegistration.jsx'
import WaitlistMonitor from './pages/WaitlistMonitor.jsx'

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

// ─── Network Global Bridge ───────────────────────────────────────────────────────
// Connects the React NetworkContext to the Axios singleton (non-React)
function NetworkGlobalBridge() {
  const { triggerOffline } = useNetwork();
  React.useEffect(() => {
    setGlobalTriggerOffline(triggerOffline);
  }, [triggerOffline]);
  return null;
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
                <Routes>
                  {/* Public */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/menu/:restaurantId/:tableNumber" element={<CustomerMenu />} />
                  <Route path="/join-waitlist/:restaurantId" element={<WaitlistRegistration />} />
                  <Route path="/waitlist-monitor/:restaurantId" element={<WaitlistMonitor />} />

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
