import React, { useState } from "react";
import "../Styless/Forgot.css";

function ResetPasswordRequest() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // 'success' or 'error'

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    console.log("Attempting to send reset email for:", email);
    console.log("Sending request to: http://localhost:8081/reset-password");

    try {
      const response = await fetch("http://localhost:8081/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      // Check if response is ok
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Response data:", data);

      if (data.success) {
        setMessage("Password reset link has been sent to your email!");
        setMessageType("success");
        setEmail("");
      } else {
        setMessage(data.message || "Failed to send reset email");
        setMessageType("error");
      }
    } catch (error) {
      console.error("Full error object:", error);
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      
      let errorMessage = "Network error. Please try again.";
      
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        errorMessage = "Cannot connect to server. Make sure the backend is running on port 8081.";
      } else if (error.message.includes('HTTP error')) {
        errorMessage = `Server error: ${error.message}`;
      }
      
      setMessage(errorMessage);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reset-container">
      <form onSubmit={handleSubmit} className="reset-form">
        <h2>Reset Password</h2>
        <p className="reset-description">
          Enter your email address and we'll send you a link to reset your password.
        </p>
        
        {message && (
          <div className={`message ${messageType}`}>
            {message}
          </div>
        )}

        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
        
        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
        
        <div className="back-to-login">
          <a href="/login">Back to Login</a>
        </div>
        
        {/* Debug info - remove this in production */}
        <div style={{fontSize: '12px', color: '#666', marginTop: '20px'}}>
          <p>Backend URL: http://localhost:8081/reset-password</p>
          <p>Check browser console for detailed error logs</p>
        </div>
      </form>
    </div>
  );
}

export default ResetPasswordRequest;