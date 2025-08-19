import React from 'react';
import '../Styless/Footer.css';
import { FaFacebook, FaInstagram, FaTwitter, FaEnvelope } from 'react-icons/fa';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="social-icons">
        <a href="https://facebook.com" target="_blank" rel="noopener noreferrer"><FaFacebook /></a>
        <a href="https://instagram.com" target="_blank" rel="noopener noreferrer"><FaInstagram /></a>
        <a href="https://twitter.com" target="_blank" rel="noopener noreferrer"><FaTwitter /></a>
        <a href="mailto:contact@mhbs.com"><FaEnvelope /></a>
      </div>
      <p className="rights">© 2025 MHBS. All rights reserved.</p>
    </footer>
  );
};

export default Footer;
