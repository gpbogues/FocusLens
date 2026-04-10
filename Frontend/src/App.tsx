import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import Login from './components/Login/Login'
import Layout from './components/Layout/Layout'
import Home from './components/Home/Home'
import Profile from './components/Profile/Profile'
import Metrics from './components/Metrics/Metrics'
import Sessions from './components/Sessions/Sessions'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'

//Redirects to /login if user is not authenticated (based off of user object in AuthContext)
//Returns null while the /me cookie check is in-flight to prevent flash-redirect on hard refresh
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <div className="app-loading-spinner" />
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

//Redirects to / if user is already logged in
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <div className="app-loading-spinner" />
  return user ? <Navigate to="/" replace /> : <>{children}</>
}

function AppRoutes() {
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  const handleToggleSession = () => {
    if (isSessionActive) setIsPaused(false)
    setIsSessionActive(prev => !prev)
  }

  const handlePauseSession = () => {
    setIsPaused(prev => !prev)
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
              isPaused={isPaused}
              onPauseSession={handlePauseSession}
            />
          </ProtectedRoute>
        }
      >
        <Route index element={<Home />} />
        <Route path="profile" element={<Profile />} />
        <Route path="metrics" element={<Metrics />} />
        <Route path="sessions" element={<Sessions />} />
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
