import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import LoginPage from './pages/Login.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
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

function ProtectedRoute({ children, section }) {
  const { isAuthenticated, canAccess } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (section && !canAccess(section)) return <Navigate to="/pos" replace />
  return children
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
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
              <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/pos" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
