import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "../Styless/Header.css";

function Header() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
    navigate("/");
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (searchQuery.trim() === "") return;

    try {
      const res = await axios.post("http://localhost:8081/search-halls", {
        location: searchQuery.trim(),
      });

      // Send halls to search results page using router state
      navigate("/search-results", { state: { halls: res.data } });
      setSearchQuery(""); // clear field
    } catch (err) {
      console.error("Search failed:", err);
    }
  };
  const GotoHome=()=>{
    navigate("/");
  }

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo-circle" onClick={GotoHome}>MHBS</div>
        <nav className="nav-links">
          <Link to="/">Home</Link>
          {user && user.role === "user" && <Link to="/mybookings">My Booking</Link>}
          {user && user.role === "admin" && <Link to="/admin-dashboard">Dashboard</Link>}
          <Link to="/services">Services</Link>
          <Link to="/about">About</Link>
        </nav>
      </div>

      {/* 🔍 Search Bar */}
      <form onSubmit={handleSearch} className="search-bar">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search city or location..."
        />
        <button type="submit">🔍</button>
      </form>

      <div className="header-right">
        {user ? (
          <div className="user-section">
            <span>Welcome, {user.name}</span>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        ) : (
          <Link to="/login" className="login-btn">Login</Link>
        )}
      </div>
    </header>
  );
}

export default Header;
