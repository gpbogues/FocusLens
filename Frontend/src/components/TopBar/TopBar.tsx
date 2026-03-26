import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import './TopBar.css';

const TopBar = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleTitleClick = () => navigate('/');
  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <>
      <header className="top-bar">
        <button className="menu-trigger" onClick={toggleSidebar}>
          ☰
        </button>
        <h1 className="top-bar-title" onClick={handleTitleClick}>
          FocusLens
        </h1>
      </header>
      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
    </>
  );
};

export default TopBar;
