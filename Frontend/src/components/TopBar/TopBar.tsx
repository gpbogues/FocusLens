import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DropdownMenu from './DropdownMenu';
import './TopBar.css';

const TopBar = () => {
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleTitleClick = () => navigate('/');
  const toggleDropdown = () => setIsDropdownOpen(prev => !prev);
  const closeDropdown = () => setIsDropdownOpen(false);

  return (
    <header className="top-bar">
      <div className="menu-trigger-container">
        <button className="menu-trigger" onClick={toggleDropdown}>
          Menu ▼
        </button>
        <DropdownMenu isOpen={isDropdownOpen} onClose={closeDropdown} />
      </div>
      <h1 className="top-bar-title" onClick={handleTitleClick}>
        FocusLens
      </h1>
    </header>
  );
};

export default TopBar;
