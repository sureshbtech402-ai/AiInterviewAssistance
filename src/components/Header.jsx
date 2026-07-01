import { useState } from "react";
import "../styles/header.css";

function Header({ user, logout }) {

  const [showMenu, setShowMenu] = useState(false);

  return (
    <header className="header">

      {/* Left */}

      <div className="header-left">

        <div className="logo-icon">
          🤖
        </div>

        <h1 className="logo-text">
          AI Interview Assistant
        </h1>

      </div>

      {/* Right */}

      <div className="header-right">

        <div className="connection-status">
          <span className="status-dot"></span>
          Connected
        </div>

        <div
          className="user-profile"
          onClick={() => setShowMenu(!showMenu)}
        >

          <img
            src={user.photoURL}
            alt="profile"
            className="avatar"
          />

          <div className="user-name">
            {user.displayName}
          </div>

          <div className="arrow">
            ▼
          </div>

          {showMenu && (

            <div className="profile-menu">

              <button
                className="logout-btn"
                onClick={logout}
              >
                Logout
              </button>

            </div>

          )}

        </div>

      </div>

    </header>
  );
}

export default Header;