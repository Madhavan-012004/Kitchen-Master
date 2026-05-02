import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { NetworkProvider, useNetwork, setGlobalTriggerOffline } from './context/NetworkContext.jsx';
import NetworkErrorOverlay from './components/NetworkErrorOverlay.jsx';
import Welcome from './pages/Welcome';
import Home from './pages/Home';
import OtpLogs from './pages/OtpLogs';
import './index.css';

// Protected route — requires login to access the menu
function ProtectedMenu({ element }) {
  const token = localStorage.getItem('km_token');
  const user = JSON.parse(localStorage.getItem('km_user') || '{}');
  if (!token || !user?.phone) {
    // Preserve current URL as redirect for after login
    return <Navigate to={window.location.pathname.replace('/menu/', '/order/')} replace />;
  }
  return element;
}

// Connects the NetworkContext to the Axios singleton (non-React scope)
function NetworkGlobalBridge() {
  const { triggerOffline, isOffline, errorType, statusCode, retryNow } = useNetwork();
  React.useEffect(() => {
    setGlobalTriggerOffline(triggerOffline);
  }, [triggerOffline]);
  return <NetworkErrorOverlay isOffline={isOffline} errorType={errorType} statusCode={statusCode} retryNow={retryNow} />;
}

function App() {
  return (
    <NetworkProvider>
      <Router>
        <Routes>
          {/* Step 1: Customer lands here from QR scan → Welcome / Details screen */}
          <Route path="/order/:restaurantId/:tableNumber" element={<Welcome />} />

          {/* Step 2: After login → protected menu page */}
          <Route
            path="/menu/:restaurantId/:tableNumber"
            element={<ProtectedMenu element={<Home />} />}
          />

          {/* Admin / internal routes */}
          <Route path="/otp-logs" element={<OtpLogs />} />

          {/* Legacy /login fallback */}
          <Route path="/login" element={<Navigate to="/" replace />} />

          {/* Catch-all */}
          <Route path="*" element={
            <div style={{
              height: '100vh', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              background: '#080808', color: '#fff', gap: '12px'
            }}>
              <div style={{ fontSize: '48px' }}>🍽️</div>
              <h2 style={{ fontWeight: 800 }}>Scan a Table QR Code</h2>
              <p style={{ color: '#666', fontSize: '14px' }}>
                Please scan the QR code on your table to begin ordering.
              </p>
            </div>
          } />
        </Routes>
      </Router>
      {/* Network Error Overlay — above all routes */}
      <NetworkGlobalBridge />
    </NetworkProvider>
  );
}

export default App;

