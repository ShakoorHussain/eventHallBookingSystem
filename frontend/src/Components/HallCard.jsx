import React, { useState } from "react";
import { useNavigate } from 'react-router-dom';
import "../Styless/HallCard.css";
import BookingForm from "../Pages/BookingForm";

function HallCard({ hall, onBookingSuccess }) {
  const [showBookingForm, setShowBookingForm] = useState(false);
  const navigate = useNavigate();

  const handleBookNow = () => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      // User not logged in, redirect to login
      alert('Please login first to book a hall');
      navigate('/login');
      return;
    }

    const user = JSON.parse(userData);
    if (user.role !== 'user') {
      alert('Only users can book halls');
      return;
    }

    // Show booking form
    setShowBookingForm(true);
  };

  const closeBookingForm = () => {
    setShowBookingForm(false);
  };

  const handleBookingSuccess = () => {
    setShowBookingForm(false);
    // Refresh the halls list to show updated booking status
    if (onBookingSuccess) {
      onBookingSuccess();
    }
  };

  // Check if hall has any booked dates
  const hasBookedDates = hall.bookedDates && hall.bookedDates.length > 0;

  return (
    <>
      <div className="hall-card">
        <img src={hall.image} alt={hall.name} className="hall-image" />
        <div className="hall-details">
          <h2 className="hall-name">{hall.name}</h2>
          <p className="hall-description">{hall.description}</p>
          <p><strong>Capacity:</strong> {hall.capacity} people</p>
          <p><strong>Location:</strong> {hall.location}</p>
          <p><strong>Price:</strong> {hall.price} PKR</p>
          <p><strong>Contact:</strong> {hall.contact}</p>
          
          {/* Show booked dates if any */}
          {hasBookedDates && (
            <div className="booked-dates">
              <p><strong>Booked Dates:</strong></p>
              <ul className="booked-dates-list">
                {hall.bookedDates.map((booking, index) => (
                  <li key={index} className="booked-date-item">
                    {booking.date} at {booking.time}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Always show Book Now button - let BookingForm handle date validation */}
          <button className="book-btn" onClick={handleBookNow}>
            Book Now
          </button>
        </div>
      </div>

      {showBookingForm && (
        <BookingForm 
          hall={hall} 
          onClose={closeBookingForm}
          onBookingSuccess={handleBookingSuccess}
          bookedDates={hall.bookedDates || []}
        />
      )}
    </>
  );
}

export default HallCard;