import { useState } from "react";
import "../styles/header.css";

function Header({ logout }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <header className="header">
      <div className="header-right">
        <button
          type="button"
          className="dropdown-icon"
          onClick={() => setShowMenu((previous) => !previous)}
          aria-label="Open menu"
        >
          ▼
        </button>

        {showMenu && (
          <div className="profile-menu">
            <button
              type="button"
              className="logout-btn"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;