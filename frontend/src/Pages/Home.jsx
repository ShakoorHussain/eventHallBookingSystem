import React, { useState, useEffect } from 'react';
import Header from '../Components/Header';
import Footer from '../Components/Footer';
import HallCard from '../Components/HallCard';
import axios from 'axios';
import '../Styless/HallCard.css';
import '../Styless/Home.css';
import { useLocation } from 'react-router-dom';
import ChatBot from '../Components/ChatBox';
function Home() {
  const [halls, setHalls] = useState([]);
  const [loading, setLoading] = useState(true);

  const location = useLocation();
  
  // Extract ?location=lahore from URL
  const searchParams = new URLSearchParams(location.search);
  const searchLocation = searchParams.get('location');

  useEffect(() => {
    if (searchLocation) {
      fetchHallsByLocation(searchLocation);
    } else {
      fetchHallsWithBookingStatus();
    }
  }, [searchLocation]);

  const fetchHallsWithBookingStatus = async () => {
    try {
      const response = await axios.get('http://localhost:8081/halls-with-bookings');
      setHalls(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching halls:', error);
      fallbackDummyData();
    }
  };

  const fetchHallsByLocation = async (locationQuery) => {
    try {
      const response = await axios.get(`http://localhost:8081/api/halls/search?location=${locationQuery}`);
      setHalls(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error searching halls:', error);
      fallbackDummyData();
    }
  };

  const fallbackDummyData = () => {
    setHalls([
      {
        id: 1,
        name: "Royal Event Hall",
        description: "Elegant and spacious hall for weddings.",
        capacity: 300,
        location: "Lahore",
        price: 50000,
        contact: "0321-1234567",
        image: "https://media.weddingz.in/images/d9bf1ccf8d25b02fe9333442d1a42e70/b-nagi-reddy-wedding-hall-b-nagi-reddy-wedding-hall-hall-2.jpg",
        bookedDates: []
      }
    ]);
    setLoading(false);
  };

  const refreshHalls = () => {
    if (searchLocation) {
      fetchHallsByLocation(searchLocation);
    } else {
      fetchHallsWithBookingStatus();
    }
  };

  return (
    <div className="page-container">
      <Header />
      <main className="content-container">
        {loading ? (
          <div className="loading">Loading halls...</div>
        ) : halls.length === 0 ? (
          <div className="no-results">No halls found for this location.</div>
        ) : (
          <div className="hall-list">
            {halls.map(hall => (
              <HallCard 
                key={hall.id} 
                hall={hall} 
                onBookingSuccess={refreshHalls}
              />
            ))}
          </div>
        )}
      </main>
         {<ChatBot/>}
      <Footer />
    </div>
  );
}

export default Home;
