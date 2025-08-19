import React, { useState, useEffect } from "react";
import axios from "axios";
import "../Styless/AdminDashboard.css";
import { useNavigate } from "react-router-dom";

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("bookings");
  const [bookings, setBookings] = useState([]);
  const [halls, setHalls] = useState([]);
  const [showHallForm, setShowHallForm] = useState(false);
  const [editingHall, setEditingHall] = useState(null);
  const [paymentFilter, setPaymentFilter] = useState("all");
  const navigate = useNavigate();
  const [hallForm, setHallForm] = useState({
    name: "",
    description: "",
    capacity: "",
    location: "",
    price: "",
    contact: "",
    image: "",
  });

  useEffect(() => {
    fetchBookings();
    fetchHalls();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await axios.get("http://localhost:8081/admin/bookings");
      setBookings(response.data);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    }
  };

  const fetchHalls = async () => {
    try {
      // Fetch all halls including inactive ones for admin
      const response = await axios.get("http://localhost:8081/admin/halls/all");
      setHalls(response.data);
    } catch (error) {
      console.error("Error fetching halls:", error);
    }
  };

  // Update booking status with payment consideration
  const updateBookingStatus = async (bookingId, status, booking) => {
    try {
      await axios.put(`http://localhost:8081/admin/bookings/${bookingId}`, {
        status,
      });

      if (status === "approved") {
        // Send confirmation email with proper data
        console.log("Booking object:", booking);
        await axios.post("http://localhost:8081/sendBookingEmail", {
          to: booking.userEmail,
          subject: "Your Marriage Hall Booking is Approved - Payment Required",
          bookingDetails: {
            hallName: booking.hall_name || booking.actualHallName,
            location: booking.hallLocation || "Location not available",
            time: booking.time,
            capacity: booking.guests,
            price: booking.total_price,
          },
        });
      }

      fetchBookings();
      
      if (status === "approved") {
        alert(`Booking ${status}! Customer has been notified via email and can now proceed with payment.`);
      } else {
        alert(`Booking ${status} successfully.`);
      }
    } catch (error) {
      alert("Error updating booking or sending email");
      console.error("Error:", error);
    }
  };

  const removeBookingFromHistory = async (bookingId) => {
    if (window.confirm("Are you sure you want to remove this booking from history? This action cannot be undone.")) {
      try {
        const response = await axios.delete(`http://localhost:8081/admin/bookings/${bookingId}/remove`);
        
        if (response.data.success) {
          alert("Booking removed from history successfully!");
          // Remove the booking from the list
          setBookings((prev) => prev.filter((booking) => booking.id !== bookingId));
        } else {
          alert(response.data.message || "Failed to remove booking from history.");
        }
      } catch (error) {
        alert("Error removing booking from history");
        console.error("Error removing booking from history:", error);
      }
    }
  };

  const handleHallFormChange = (e) => {
    setHallForm({
      ...hallForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleHallSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingHall) {
        await axios.put(
          `http://localhost:8081/admin/halls/${editingHall.id}`,
          hallForm
        );
        alert("Hall updated successfully!");
      } else {
        await axios.post("http://localhost:8081/admin/halls", hallForm);
        alert("Hall added successfully!");
      }
      setShowHallForm(false);
      setEditingHall(null);
      setHallForm({
        name: "",
        description: "",
        capacity: "",
        location: "",
        price: "",
        contact: "",
        image: "",
      });
      fetchHalls();
    } catch (error) {
      alert("Error saving hall");
      console.error("Error saving hall:", error);
    }
  };

  const editHall = (hall) => {
    setEditingHall(hall);
    setHallForm(hall);
    setShowHallForm(true);
  };

  const deleteHall = async (hallId) => {
    if (
      window.confirm(
        "Are you sure you want to delete this hall? This will permanently remove it."
      )
    ) {
      try {
        await axios.delete(`http://localhost:8081/admin/halls/${hallId}`);
        alert("Hall deleted successfully!");
        fetchHalls();
      } catch (error) {
        alert("Error deleting hall");
        console.error("Error deleting hall:", error);
      }
    }
  };

  const restoreHall = async (hallId) => {
    try {
      await axios.put(`http://localhost:8081/admin/halls/${hallId}/restore`);
      alert("Hall restored successfully!");
      fetchHalls();
    } catch (error) {
      alert("Error restoring hall");
      console.error("Error restoring hall:", error);
    }
  };

  const handleClick = () => {
    navigate('/');
  };

  // Filter bookings based on payment status
  const getFilteredBookings = () => {
    switch (paymentFilter) {
      case "paid":
        return bookings.filter(booking => booking.payment_status === 'paid');
      case "unpaid":
        return bookings.filter(booking => booking.payment_status !== 'paid');
      case "pending":
        return bookings.filter(booking => booking.status === 'pending');
      case "approved":
        return bookings.filter(booking => booking.status === 'approved');
      case "rejected":
        return bookings.filter(booking => booking.status === 'rejected');
      default:
        return bookings;
    }
  };

  // Get payment status display
  const getPaymentStatusDisplay = (booking) => {
    if (booking.status === 'rejected') {
      return 'N/A';
    }
    if (booking.status === 'pending') {
      return 'Awaiting Approval';
    }
    return booking.payment_status === 'paid' ? 'Paid' : 'Payment Pending';
  };

  // Get booking status with payment consideration
  const getBookingStatusDisplay = (booking) => {
    if (booking.status === 'approved' && booking.payment_status === 'paid') {
      return 'Confirmed & Paid';
    }
    if (booking.status === 'approved' && booking.payment_status !== 'paid') {
      return 'Approved - Payment Pending';
    }
    return booking.status.charAt(0).toUpperCase() + booking.status.slice(1);
  };

  return (
    <div className="admin-dashboard">
      <h1>Admin Dashboard</h1>
      <div>
        <button
          onClick={handleClick}
          style={{
            position: "absolute",
            left: "10px",
            top: "10px",
            padding: "10px 20px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Go to Home
        </button>
      </div>
      
      <div className="dashboard-tabs">
        <button
          className={activeTab === "bookings" ? "active" : ""}
          onClick={() => setActiveTab("bookings")}
        >
          Bookings Management
        </button>
        <button
          className={activeTab === "halls" ? "active" : ""}
          onClick={() => setActiveTab("halls")}
        >
          Halls Management
        </button>
      </div>

      {activeTab === "bookings" && (
        <div className="bookings-section">
          <div className="bookings-header">
            <h2>Booking Requests</h2>
            <div className="booking-filters">
              <label>Filter by: </label>
              <select 
                value={paymentFilter} 
                onChange={(e) => setPaymentFilter(e.target.value)}
                style={{
                  padding: "5px 10px",
                  marginLeft: "10px",
                  borderRadius: "4px",
                  border: "1px solid #ccc"
                }}
              >
                <option value="all">All Bookings</option>
                <option value="pending">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
          </div>

          {getFilteredBookings().length === 0 ? (
            <p>No bookings found for the selected filter.</p>
          ) : (
            <div className="bookings-grid">
              {getFilteredBookings().map((booking) => (
                <div key={booking.id} className="booking-card">
                  <h3>{booking.hall_name}</h3>
                  <p>
                    <strong>Customer:</strong> {booking.userName}
                  </p>
                  <p>
                    <strong>Email:</strong> {booking.userEmail}
                  </p>
                  <p>
                    <strong>Date:</strong> {booking.date}
                  </p>
                  <p>
                    <strong>Time:</strong> {booking.time}
                  </p>
                  <p>
                    <strong>Guests:</strong> {booking.guests}
                  </p>
                  <p>
                    <strong>Event Type:</strong> {booking.event_type}
                  </p>
                  <p>
                    <strong>Price:</strong> {booking.total_price} PKR
                  </p>

                  <p>
                    <strong>Status:</strong>
                    <span className={`status ${booking.status} ${booking.payment_status === 'paid' ? 'paid' : ''}`}>
                      {getBookingStatusDisplay(booking)}
                    </span>
                  </p>

                  {/* Payment Status Display */}
                  <p>
                    <strong>Payment Status:</strong>
                    <span className={`payment-status ${booking.payment_status || 'pending'}`}>
                      {getPaymentStatusDisplay(booking)}
                    </span>
                  </p>

                  {/* Payment Intent ID if available */}
                  {booking.payment_intent_id && (
                    <p>
                      <strong>Payment ID:</strong> 
                      <span style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                        {booking.payment_intent_id}
                      </span>
                    </p>
                  )}

                  <div className="booking-actions">
                    {booking.status === "pending" && (
                      <>
                        <button
                          onClick={() =>
                            updateBookingStatus(booking.id, "approved", booking)
                          }
                          className="approve-btn"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() =>
                            updateBookingStatus(booking.id, "rejected", booking)
                          }
                          className="reject-btn"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {/* Show payment status info for approved bookings */}
                    {booking.status === "approved" && booking.payment_status !== 'paid' && (
                      <div className="payment-info">
                        <small style={{ color: '#ff9500', fontWeight: 'bold' }}>
                          ⏳ Waiting for customer payment
                        </small>
                      </div>
                    )}

                    {booking.status === "approved" && booking.payment_status === 'paid' && (
                      <div className="payment-info">
                        <small style={{ color: '#28a745', fontWeight: 'bold' }}>
                          ✅ Payment completed
                        </small>
                      </div>
                    )}
                    
                    <button
                      onClick={() => removeBookingFromHistory(booking.id)}
                      className="remove-history-btn"
                      title="Remove this booking from history"
                    >
                      Remove from History
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "halls" && (
        <div className="halls-section">
          <div className="halls-header">
            <h2>Halls Management</h2>
            <button
              onClick={() => setShowHallForm(true)}
              className="add-hall-btn"
            >
              Add New Hall
            </button>
          </div>

          <div className="halls-grid">
            {halls.map((hall) => (
              <div
                key={hall.id}
                className={`hall-card ${!hall.is_active ? "inactive" : ""}`}
              >
                <img src={hall.image} alt={hall.name} />
                <div className="hall-info">
                  <h3>
                    {hall.name}
                    {!hall.is_active && (
                      <span className="inactive-badge">(Deleted)</span>
                    )}
                  </h3>
                  <p>{hall.description}</p>
                  <p>
                    <strong>Capacity:</strong> {hall.capacity}
                  </p>
                  <p>
                    <strong>Location:</strong> {hall.location}
                  </p>
                  <p>
                    <strong>Price:</strong> {hall.price} PKR
                  </p>
                  <p>
                    <strong>Contact:</strong> {hall.contact}
                  </p>
                  <div className="hall-actions">
                    {hall.is_active ? (
                      <>
                        <button
                          onClick={() => editHall(hall)}
                          className="edit-btn"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteHall(hall.id)}
                          className="delete-btn"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => restoreHall(hall.id)}
                        className="restore-btn"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showHallForm && (
        <div className="hall-form-overlay">
          <div className="hall-form-container">
            <h2>{editingHall ? "Edit Hall" : "Add New Hall"}</h2>
            <form onSubmit={handleHallSubmit}>
              <div className="form-group">
                <label>Hall Name:</label>
                <input
                  type="text"
                  name="name"
                  value={hallForm.name}
                  onChange={handleHallFormChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description:</label>
                <textarea
                  name="description"
                  value={hallForm.description}
                  onChange={handleHallFormChange}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Capacity:</label>
                  <input
                    type="number"
                    name="capacity"
                    value={hallForm.capacity}
                    onChange={handleHallFormChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Location:</label>
                  <input
                    type="text"
                    name="location"
                    value={hallForm.location}
                    onChange={handleHallFormChange}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Price (PKR):</label>
                  <input
                    type="number"
                    name="price"
                    value={hallForm.price}
                    onChange={handleHallFormChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Contact:</label>
                  <input
                    type="text"
                    name="contact"
                    value={hallForm.contact}
                    onChange={handleHallFormChange}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Image URL:</label>
                <input
                  type="url"
                  name="image"
                  value={hallForm.image}
                  onChange={handleHallFormChange}
                  required
                />
              </div>
              <div className="form-buttons">
                <button
                  type="button"
                  onClick={() => {
                    setShowHallForm(false);
                    setEditingHall(null);
                    setHallForm({
                      name: "",
                      description: "",
                      capacity: "",
                      location: "",
                      price: "",
                      contact: "",
                      image: "",
                    });
                  }}
                >
                  Cancel
                </button>
                <button type="submit">
                  {editingHall ? "Update" : "Add"} Hall
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;