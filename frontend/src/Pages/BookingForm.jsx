import React, { useState } from 'react';
import axios from 'axios';
import '../Styless/BookingForm.css';

function BookingForm({ hall, onClose }) {
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    guests: '',
    eventType: '',
    specialRequests: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = JSON.parse(localStorage.getItem('user'));
      const bookingData = {
        userId: user.id,
        hallId: hall.id,
        hallName: hall.name,
        date: formData.date,
        time: formData.time,
        guests: formData.guests,
        eventType: formData.eventType,
        specialRequests: formData.specialRequests,
        totalPrice: hall.price,
        status: 'pending'
      };

      const response = await axios.post('http://localhost:8081/bookings', bookingData);
      
      if (response.data.success) {
        alert('Booking submitted successfully! Please wait for admin approval.');
        onClose();
        window.location.reload(); // Refresh to update hall status
      } else {
        alert('Booking failed: ' + response.data.message);
      }
    } catch (error) {
      alert('Error submitting booking. Please try again.');
      console.error('Booking error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="booking-overlay">
      <div className="booking-form-container">
        <div className="booking-form-header">
          <h2>Book {hall.name}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="hall-info">
          <p><strong>Location:</strong> {hall.location}</p>
          <p><strong>Capacity:</strong> {hall.capacity} people</p>
          <p><strong>Price:</strong> {hall.price} PKR</p>
        </div>

        <form onSubmit={handleSubmit} className="booking-form">
          <div className="form-row">
            <div className="form-group">
              <label>Event Date:</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>
            <div className="form-group">
              <label>Event Time:</label>
              <select name="time" value={formData.time} onChange={handleChange} required>
                <option value="">Select Time</option>
                <option value="Morning (9 AM - 12 PM)">Morning (9 AM - 12 PM)</option>
                <option value="Afternoon (1 PM - 5 PM)">Afternoon (1 PM - 5 PM)</option>
                <option value="Evening (6 PM - 10 PM)">Evening (6 PM - 10 PM)</option>
                <option value="Full Day (9 AM - 10 PM)">Full Day (9 AM - 10 PM)</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Number of Guests:</label>
              <input
                type="number"
                name="guests"
                value={formData.guests}
                onChange={handleChange}
                max={hall.capacity}
                min="1"
                required
              />
            </div>
            <div className="form-group">
              <label>Event Type:</label>
              <select name="eventType" value={formData.eventType} onChange={handleChange} required>
                <option value="">Select Event Type</option>
                <option value="Wedding">Wedding</option>
                <option value="Birthday Party">Birthday Party</option>
                <option value="Corporate Event">Corporate Event</option>
                <option value="Conference">Conference</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Special Requests (Optional):</label>
            <textarea
              name="specialRequests"
              value={formData.specialRequests}
              onChange={handleChange}
              rows="3"
              placeholder="Any special requirements for your event..."
            ></textarea>
          </div>

          <div className="total-price">
            <h3>Total Price: {hall.price} PKR</h3>
          </div>

          <div className="form-buttons">
            <button type="button" onClick={onClose} className="cancel-btn">Cancel</button>
            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Submitting...' : 'Submit Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BookingForm;