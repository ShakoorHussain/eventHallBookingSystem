import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../Styless/ResetPassword.css";

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [passwords, setPasswords] = useState({
    newPassword: "",
    confirmPassword: ""
  });
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // 'success' or 'error'
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  // Verify token on component mount
  useEffect(() => {
    const verifyToken = async () => {
      try {
        const response = await fetch(`http://localhost:8081/verify-reset-token/${token}`);
        const data = await response.json();

        if (data.success) {
          setTokenValid(true);
          setUserEmail(data.email);
        } else {
          setMessage(data.message || "Invalid or expired reset token");
          setMessageType("error");
          setTokenValid(false);
        }
      } catch (error) {
        console.error("Token verification error:", error);
        setMessage("Network error. Please try again.");
        setMessageType("error");
        setTokenValid(false);
      } finally {
        setVerifying(false);
      }
    };

    if (token) {
      verifyToken();
    } else {
      setMessage("Invalid reset link");
      setMessageType("error");
      setVerifying(false);
    }
  }, [token]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPasswords(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    // Validate passwords
    if (passwords.newPassword !== passwords.confirmPassword) {
      setMessage("Passwords do not match");
      setMessageType("error");
      setLoading(false);
      return;
    }

    if (passwords.newPassword.length < 6) {
      setMessage("Password must be at least 6 characters long");
      setMessageType("error");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("http://localhost:8081/update-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token,
          newPassword: passwords.newPassword
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage("Password updated successfully! Redirecting to login...");
        setMessageType("success");
        
        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      } else {
        setMessage(data.message || "Failed to update password");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Error:", error);
      setMessage("Network error. Please try again.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="reset-password-container">
        <div className="reset-password-form">
          <div className="loading">Verifying reset token...</div>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="reset-password-container">
        <div className="reset-password-form">
          <h2>Invalid Reset Link</h2>
          {message && (
            <div className={`message ${messageType}`}>
              {message}
            </div>
          )}
          <div className="back-to-login">
            <a href="/forgot-password">Request New Reset Link</a>
            <span> | </span>
            <a href="/login">Back to Login</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password-container">
      <form onSubmit={handleSubmit} className="reset-password-form">
        <h2>Reset Your Password</h2>
        <p className="reset-description">
          Enter your new password for: <strong>{userEmail}</strong>
        </p>
        
        {message && (
          <div className={`message ${messageType}`}>
            {message}
          </div>
        )}

        <input
          type="password"
          name="newPassword"
          placeholder="Enter new password"
          value={passwords.newPassword}
          onChange={handleInputChange}
          required
          disabled={loading}
          minLength="6"
        />

        <input
          type="password"
          name="confirmPassword"
          placeholder="Confirm new password"
          value={passwords.confirmPassword}
          onChange={handleInputChange}
          required
          disabled={loading}
          minLength="6"
        />
        
        <button type="submit" disabled={loading}>
          {loading ? "Updating..." : "Update Password"}
        </button>
        
        <div className="back-to-login">
          <a href="/login">Back to Login</a>
        </div>
      </form>
    </div>
  );
}

export default ResetPassword;