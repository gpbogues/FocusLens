import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import Layout from './components/Layout/Layout'
import Home from './components/Home/Home'
import Profile from './components/Profile/Profile'
import Metrics from './components/Metrics/Metrics'

function App() {
  const [isSessionActive, setIsSessionActive] = useState(false)

  const handleToggleSession = () => {
    setIsSessionActive(prev => !prev)
  }

  return (
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
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
