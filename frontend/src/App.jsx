import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './Pages/Home';
import Login from './Pages/Login';
import Register from './Pages/Register';
import About from './Pages/About';
import Services from './Pages/Services';
import MyBookings from './Pages/MyBookings';
import AdminDashboard from './Pages/AdminDashboard';
import Forgot from './Pages/Forgot';
import ResetPassword from './Pages/ResetPassword';
import SearchResults from './Pages/SearchResults';

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/" />;
  }
  
  return children;
};

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/about" element={<About />} />
          <Route path="/services" element={<Services />} />
          <Route path="/login/forgot" element={<Forgot/>} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/search-results" element={<SearchResults />} />
          <Route 
            path="/mybookings" 
            element={
              <ProtectedRoute>
                <MyBookings />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin-dashboard" 
            element={
              <ProtectedRoute adminOnly={true}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;