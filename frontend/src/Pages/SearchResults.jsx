import React from "react";
import { useLocation } from "react-router-dom";
import HallCard from "../Components/HallCard";
import Header from "../Components/Header";
import Footer from "../Components/Footer";

function SearchResults() {
  const location = useLocation();
  const halls = location.state?.halls || [];

  return (
    <div className="page-container">
      <Header />
      <main className="content-container">
        {halls.length > 0 ? (
          <div className="hall-list">
            {halls.map((hall) => (
              <HallCard key={hall.id} hall={hall} />
            ))}
          </div>
        ) : (
          <div style={{
            padding:"10px"
          }}>No halls found for that location.</div>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default SearchResults;
