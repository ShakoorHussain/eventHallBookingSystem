import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import axios from 'axios';
import '../Styless/PaymentForm.css';

// Replace with your Stripe publishable key
const stripePromise = loadStripe('pk_test_51your_stripe_publishable_key_here');

const CheckoutForm = ({ booking, onPaymentSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Create payment intent on server
      const response = await axios.post('http://localhost:8081/create-payment-intent', {
        amount: booking.totalPrice * 100, // Convert to cents
        bookingId: booking.id,
        currency: 'pkr' // Pakistani Rupee
      });

      const { client_secret } = response.data;

      // Confirm payment with Stripe
      const result = await stripe.confirmCardPayment(client_secret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: {
            name: booking.userName,
            email: booking.userEmail,
          },
        }
      });

      if (result.error) {
        setError(result.error.message);
      } else {
        // Payment succeeded
        if (result.paymentIntent.status === 'succeeded') {
          // Update booking payment status
          await axios.put(`http://localhost:8081/bookings/${booking.id}/payment-complete`, {
            paymentIntentId: result.paymentIntent.id
          });
          
          onPaymentSuccess();
        }
      }
    } catch (err) {
      setError('Payment failed. Please try again.');
      console.error('Payment error:', err);
    }

    setProcessing(false);
  };

  return (
    <div className="payment-form-container">
      <div className="payment-header">
        <h2>Complete Your Payment</h2>
        <button className="close-btn" onClick={onCancel}>×</button>
      </div>
      
      <div className="booking-summary">
        <h3>Booking Summary</h3>
        <p><strong>Hall:</strong> {booking.hallName}</p>
        <p><strong>Date:</strong> {booking.date}</p>
        <p><strong>Time:</strong> {booking.time}</p>
        <p><strong>Guests:</strong> {booking.guests}</p>
        <p><strong>Total Amount:</strong> {booking.totalPrice} PKR</p>
      </div>

      <form onSubmit={handleSubmit} className="payment-form">
        <div className="card-element-container">
          <label>Card Details</label>
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
              },
            }}
          />
        </div>

        {error && <div className="payment-error">{error}</div>}

        <div className="payment-buttons">
          <button type="button" onClick={onCancel} className="cancel-btn">
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={!stripe || processing}
            className="pay-btn"
          >
            {processing ? 'Processing...' : `Pay ${booking.totalPrice} PKR`}
          </button>
        </div>
      </form>
    </div>
  );
};

const PaymentForm = ({ booking, onPaymentSuccess, onCancel }) => {
  return (
    <div className="payment-overlay">
      <Elements stripe={stripePromise}>
        <CheckoutForm 
          booking={booking} 
          onPaymentSuccess={onPaymentSuccess}
          onCancel={onCancel}
        />
      </Elements>
    </div>
  );
};

export default PaymentForm;