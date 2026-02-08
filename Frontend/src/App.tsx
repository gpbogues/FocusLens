import { useState } from 'react'
import './App.css'
import Sidebar from './components/Sidebar'
import WebcamFeed from './components/WebcamFeed'

function App() {
  const [isSessionActive, setIsSessionActive] = useState(false)

  const handleToggleSession = () => {
    setIsSessionActive(prev => !prev)
  }

  return (
    <div className="app-container">
      <Sidebar
        isSessionActive={isSessionActive}
        onToggleSession={handleToggleSession}
      />
      <WebcamFeed isActive={isSessionActive} />
    </div>
  )
}

export default App
