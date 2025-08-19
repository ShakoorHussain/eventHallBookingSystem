import React from "react";
import "../Styless/Services.css";
import Header from "../Components/Header";

function Services() {
    
  const servicesList = [
    {
      title: "Hall Booking",
      description: "Book beautifully decorated halls for your special events.",
      icon: "🏛️",
    },
    {
      title: "Event Management",
      description: "Get full event planning and management services.",
      icon: "🎉",
    },
    {
      title: "Catering Service",
      description: "Delicious food catering for weddings, parties, and more.",
      icon: "🍽️",
    },
    {
      title: "Photography & Videography",
      description: "Capture your moments professionally.",
      icon: "📸",
    },
  ];

  return (
    
    <div className="services">
      <h2 className="services-heading">Our Services</h2>
      <div className="services-container">
        {servicesList.map((service, index) => (
          <div className="service-card" key={index}>
            <div className="service-icon">{service.icon}</div>
            <h3 className="service-title">{service.title}</h3>
            <p className="service-description">{service.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Services;
