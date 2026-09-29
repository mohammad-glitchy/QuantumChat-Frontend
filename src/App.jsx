import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { VaultProvider } from './context/VaultContext.jsx';
import { NotificationSettingsProvider } from './context/NotificationSettingsContext.jsx';
import { ToastProvider } from './components/ToastProvider.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Register from './pages/Register.jsx';
import Login from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import Chat from './pages/Chat.jsx';
import Activity from './pages/Activity.jsx';
import BirthdayCalendar from './pages/BirthdayCalendar.jsx';
import JoinInvite from './components/JoinInvite.jsx';
import Landing from './pages/Landing.jsx';
import LinkDevice from './pages/LinkDevice.jsx';
import ScreenTimeTracker from './components/ScreenTimeTracker.jsx';

function ProtectedChat() {
  return (
    <ProtectedRoute>
      <Chat />
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ThemeProvider>
       <AuthProvider>
          <VaultProvider>
          <NotificationSettingsProvider>
            <ScreenTimeTracker />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/link-device" element={<LinkDevice />} />
              <Route
                path="/join/:code"
                element={
                  <ProtectedRoute>
                    <JoinInvite />
                  </ProtectedRoute>
                }
              />
              <Route path="/chat" element={<ProtectedChat />} />
              <Route path="/chat/activity" element={<ProtectedRoute><Activity /></ProtectedRoute>} />
              <Route path="/chat/birthdays" element={<ProtectedRoute><BirthdayCalendar /></ProtectedRoute>} />
              <Route path="/chat/settings" element={<ProtectedChat />} />
              <Route path="/chat/settings/:tab" element={<ProtectedChat />} />
              <Route path="/chat/g/:groupId" element={<ProtectedChat />} />
              <Route path="/chat/:peerId" element={<ProtectedChat />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </NotificationSettingsProvider>
          </VaultProvider>
        </AuthProvider>
      </ThemeProvider>
    </ToastProvider>
  );
}
