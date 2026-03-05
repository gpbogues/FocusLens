import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import Login from './components/Login/Login'
import Layout from './components/Layout/Layout'
import Home from './components/Home/Home'
import Profile from './components/Profile/Profile'
import Metrics from './components/Metrics/Metrics'
import { AuthProvider } from './context/AuthContext'

function App() {
  const [isSessionActive, setIsSessionActive] = useState(false)

  const handleToggleSession = () => {
    setIsSessionActive(prev => !prev)
  }

  return (
    <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Layout
              isSessionActive={isSessionActive}
              onToggleSession={handleToggleSession}
            />
          }
        >
          <Route index element={<Home />} />
          <Route path="profile" element={<Profile />} />
          <Route path="metrics" element={<Metrics />} />
          <Route path="login" element={<Login />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </AuthProvider>
  )
}

export default App
