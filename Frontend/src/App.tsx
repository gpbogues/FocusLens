import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import Login from './components/Login/Login'
import Layout from './components/Layout/Layout'
import Home from './components/Home/Home'
import Profile from './components/Profile/Profile'
import Metrics from './components/Metrics/Metrics'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'

//Redirects to /login if user is not authenticated (based off of user object in AuthContext)
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

//Redirects to / if user is already logged in
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return user ? <Navigate to="/" replace /> : <>{children}</>
}

function AppRoutes() {
  const [isSessionActive, setIsSessionActive] = useState(false)

  const handleToggleSession = () => {
    setIsSessionActive(prev => !prev)
  }

  return (
    <Routes>
      {/* Redirect to login if not authenticated */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

      {/* All other pages require authentication */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout
              isSessionActive={isSessionActive}
              onToggleSession={handleToggleSession}
            />
          </ProtectedRoute>
        }
      >
        <Route index element={<Home />} />
        <Route path="profile" element={<Profile />} />
        <Route path="metrics" element={<Metrics />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  )
}

export default App
