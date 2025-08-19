import React, { useEffect, useState } from "react";
import "../Styless/MyBookings.css";
import axios from "axios";
import PaymentForm from './PaymentForm'; // Import the new payment component

const MyBooking = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    fetchUserBookings();
  }, []);

  const fetchUserBookings = async () => {
    try {
      // Get current user from localStorage
      const userData = localStorage.getItem('user');
      if (!userData) {
        console.log("No user data found");
        setLoading(false);
        return;
      }

      const user = JSON.parse(userData);
      const response = await axios.get(`http://localhost:8081/mybookings/${user.id}`);
      setBookings(response.data);
      setLoading(false);
    } catch (err) {
      console.log("Error fetching bookings:", err);
      setLoading(false);
    }
  };

  const CancelBooking = async (id) => {
    try {
      const response = await axios.delete(`http://localhost:8081/bookings/${id}`);
      
      if (response.data.success) {
        alert("Booking cancelled successfully!");
        // Remove the cancelled booking from the list
        setBookings((prev) => prev.filter((booking) => booking.id !== id));
      } else {
        alert(response.data.message || "Failed to cancel booking.");
      }
    } catch (err) {
      console.error("Error cancelling booking:", err);
      alert("Failed to cancel booking.");
    }
  };

  const removeFromHistory = async (id) => {
    if (window.confirm("Are you sure you want to remove this booking from your history? This action cannot be undone.")) {
      try {
        const response = await axios.delete(`http://localhost:8081/user/bookings/${id}/remove`);
        
        if (response.data.success) {
          alert("Booking removed from history successfully!");
          // Remove the booking from the list
          setBookings((prev) => prev.filter((booking) => booking.id !== id));
        } else {
          alert(response.data.message || "Failed to remove booking from history.");
        }
      } catch (err) {
        console.error("Error removing booking from history:", err);
        alert("Failed to remove booking from history.");
      }
    }
  };

  const handlePayNow = (booking) => {
    setSelectedBooking(booking);
    setShowPayment(true);
  };

  const handlePaymentSuccess = async () => {
    setShowPayment(false);
    setSelectedBooking(null);
    alert("Payment successful! You will receive a confirmation email shortly.");
    
    // Refresh bookings to show updated status
    await fetchUserBookings();
  };

  const handlePaymentCancel = () => {
    setShowPayment(false);
    setSelectedBooking(null);
  };

  if (loading) {
    return (
      <div className="my-booking-container">
        <h2>My Bookings</h2>
        <p>Loading your bookings...</p>
      </div>
    );
  }

  const isCancelable = (createdAt) => {
    if (!createdAt) return false;
    const createdTime = new Date(createdAt).getTime();
    const now = new Date().getTime();
    const diffInMinutes = (now - createdTime) / (1000 * 60);
    return diffInMinutes <= 10;
  };

  const getStatusMessage = (booking) => {
    switch (booking.status) {
      case 'pending':
        return 'Waiting for admin approval';
      case 'approved':
        return booking.payment_status === 'paid' ? 'Confirmed & Paid' : 'Approved - Payment Required';
      case 'rejected':
        return 'Booking rejected';
      default:
        return booking.status;
    }
  };

  return (
    <div className="my-booking-container">
      <h2>My Bookings</h2>
      {bookings.length === 0 ? (
        <p>No bookings yet.</p>
      ) : (
        <div className="booking-list">
          {bookings.map((booking) => (
            <div key={booking.id} className="booking-card">
              <h3>{booking.hallName}</h3>
              <p><strong>Date:</strong> {booking.date}</p>
              <p><strong>Time:</strong> {booking.time}</p>
              <p><strong>Guests:</strong> {booking.guests}</p>
              <p><strong>Event Type:</strong> {booking.eventType}</p>
              <p><strong>Total Price:</strong> {booking.totalPrice} PKR</p>
              <p><strong>Status:</strong> 
                <span className={`status ${booking.status} ${booking.payment_status || ''}`}>
                  {getStatusMessage(booking)}
                </span>
              </p>
              
              {/* Show payment status if booking is approved */}
              {booking.status === 'approved' && (
                <p><strong>Payment Status:</strong> 
                  <span className={`payment-status ${booking.payment_status || 'pending'}`}>
                    {booking.payment_status === 'paid' ? 'Paid' : 'Payment Pending'}
                  </span>
                </p>
              )}
              
              <div className="booking-actions">
                {/* Show Pay Now button for approved bookings that haven't been paid */}
                {booking.status === 'approved' && booking.payment_status !== 'paid' && (
                  <button 
                    onClick={() => handlePayNow(booking)} 
                    className="btn pay-now-btn"
                  >
                    Pay Now
                  </button>
                )}

                {/* Cancel button logic remains the same */}
                {(booking.status === "approved" || booking.status === "pending") && 
                 isCancelable(booking.created_at) && 
                 booking.payment_status !== 'paid' && (
                  <button 
                    onClick={() => CancelBooking(booking.id)} 
                    className="btn cancel-btn"
                  >
                    <strong>Note: After Booking a Hall, You can cancel it in 10 Minutes</strong>
                    <strong>Cancel Booking</strong>
                  </button>
                )}

                <button 
                  onClick={() => removeFromHistory(booking.id)} 
                  className="btn remove-history-btn"
                  title="Remove this booking from your history"
                >
                  Remove from History
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && selectedBooking && (
        <PaymentForm 
          booking={selectedBooking}
          onPaymentSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
        />
      )}
    </div>
  );
};

export default MyBooking;