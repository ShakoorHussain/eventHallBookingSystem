// server.js
import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from "dotenv";
import { GoogleGenAI, Modality } from "@google/genai";
import crypto from 'crypto';
import Stripe from 'stripe';

dotenv.config();
const app = express();
const PORT = 8081;

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Database connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // Change this to your MySQL password
  database: 'marriagehall'
});

// Test database connection
db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'shakoorhussain395@gmail.com',
    pass: 'vbhgunaylrswqekb'
  }
});

const ai = new GoogleGenAI({ apiKey: process.env.GeminiApiKey });
console.log('Gemini API Key loaded:', process.env.GeminiApiKey ? 'Yes' : 'No');

// STRIPE PAYMENT ROUTES

// Create payment intent
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, bookingId, currency = 'pkr' } = req.body;

    if (!amount || !bookingId) {
      return res.status(400).json({ error: 'Amount and booking ID are required' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // Ensure amount is an integer
      currency: currency.toLowerCase(),
      metadata: {
        bookingId: bookingId.toString()
      }
    });

    res.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id
    });

  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: error.message });
  }
});

// Complete payment and update booking
app.put('/bookings/:id/payment-complete', async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { paymentIntentId } = req.body;

    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ success: false, message: 'Payment not completed' });
    }

    // Update booking payment status
    const updateQuery = `
      UPDATE bookings 
      SET payment_status = 'paid', 
          payment_intent_id = ?,
          updated_at = NOW()
      WHERE id = ?
    `;

    db.query(updateQuery, [paymentIntentId, bookingId], (err, result) => {
      if (err) {
        console.error('Database error updating payment status:', err);
        return res.status(500).json({ success: false, message: 'Failed to update payment status' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }

      // Get booking details for confirmation email
      const getBookingQuery = `
        SELECT b.*, h.name as hallName, h.location as hallLocation, u.name as userName, u.email as userEmail
        FROM bookings b
        JOIN halls h ON b.hall_id = h.id
        JOIN users u ON b.user_id = u.id
        WHERE b.id = ?
      `;

      db.query(getBookingQuery, [bookingId], async (err, bookingResults) => {
        if (err) {
          console.error('Error fetching booking details:', err);
        } else if (bookingResults.length > 0) {
          const booking = bookingResults[0];
          
          // Send payment confirmation email
          try {
            await transporter.sendMail({
              from: 'shakoorhussain395@gmail.com',
              to: booking.userEmail,
              subject: 'Payment Confirmation - Marriage Hall Booking',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #28a745;">Payment Successful!</h2>
                  <p>Your payment for the marriage hall booking has been processed successfully.</p>
                  
                  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3>Booking Details:</h3>
                    <p><strong>Hall Name:</strong> ${booking.hallName}</p>
                    <p><strong>Location:</strong> ${booking.hallLocation}</p>
                    <p><strong>Date:</strong> ${booking.date}</p>
                    <p><strong>Time:</strong> ${booking.time}</p>
                    <p><strong>Guests:</strong> ${booking.guests}</p>
                    <p><strong>Event Type:</strong> ${booking.event_type}</p>
                    <p><strong>Total Paid:</strong> ${booking.total_price} PKR</p>
                    <p><strong>Payment ID:</strong> ${paymentIntentId}</p>
                  </div>
                  
                  <p>Your booking is now confirmed and paid. Thank you for choosing our services!</p>
                  <p><strong>Contact Admin:</strong> +92-301-1234567</p>
                </div>
              `
            });
          } catch (emailError) {
            console.error('Error sending payment confirmation email:', emailError);
          }
        }
      });

      res.json({ success: true, message: 'Payment completed successfully' });
    });

  } catch (error) {
    console.error('Error completing payment:', error);
    res.status(500).json({ success: false, message: 'Payment completion failed' });
  }
});

// SEARCH ROUTES
app.post('/search-halls', (req, res) => {
  const location = req.body.location;
  if (!location) {
    return res.status(400).json({ error: "Location is required" });
  }

  const sql = "SELECT * FROM halls WHERE location LIKE ? AND is_active = true";
  const value = `%${location}%`;

  db.query(sql, [value], (err, result) => {
    if (err) {
      console.error("Search query error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(result);
  });
});

// GEMINI AI ROUTES
async function callGeminiWithRetry(prompt, maxRetries = 3, delay = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [
          { role: "user", parts: [{ text: prompt }] }
        ]
      });
      return response;
    } catch (error) {
      console.log(`Attempt ${i + 1} failed:`, error.message);
      
      if (error.status === 503 && i < maxRetries - 1) {
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        throw error;
      }
    }
  }
}

app.post('/geminiPrompt', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const hallsQuery = 'SELECT * FROM halls WHERE is_active = true'; 
    
    db.query(hallsQuery, async (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: "Database error", details: err.message });
      }

      const hallsDataJson = JSON.stringify(rows);
      
      const combinedPrompt = `
        Here is the halls data in JSON format: ${hallsDataJson}
        If user ask about greeting then answer it and ask him to how i help you.
        and don't tell the user that you have only halls knowledge , if user ask anything else say simple that sorry i can't assist you with type of information.
        Please answer the user's question ONLY based on this data.
        If the question is not related to the halls data, politely apologize and say you can't answer.

        User question: "${prompt}"
        
        Keep the response concise and helpful.
      `;

      try {
        const response = await callGeminiWithRetry(combinedPrompt);

        if (!response?.candidates?.[0]?.content?.parts?.[0]?.text) {
          return res.status(500).json({ error: "Invalid response structure from Gemini" });
        }

        const text = response.candidates[0].content.parts[0].text;
        res.json({ result: text });

      } catch (geminiError) {
        console.error("Gemini API error after retries:", geminiError);
        
        if (geminiError.status === 503) {
          res.status(503).json({ 
            error: "Gemini service is currently overloaded. Please try again in a few minutes.", 
            details: "Service temporarily unavailable" 
          });
        } else {
          res.status(500).json({ 
            error: "Gemini API error", 
            details: geminiError.message 
          });
        }
      }
    });

  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// USER BOOKING HISTORY ROUTES
app.delete('/user/bookings/:id/remove', (req, res) => {
  const bookingId = req.params.id;
  
  const query = 'DELETE FROM bookings WHERE id = ?';
  db.query(query, [bookingId], (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ success: false, message: 'Failed to remove booking from history' });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    res.json({ success: true, message: 'Booking removed from history successfully' });
  });
});

// ADMIN BOOKING HISTORY ROUTES
app.delete('/admin/bookings/:id/remove', (req, res) => {
  const bookingId = req.params.id;
  
  const query = 'DELETE FROM bookings WHERE id = ?';
  db.query(query, [bookingId], (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ success: false, message: 'Failed to remove booking from history' });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    res.json({ success: true, message: 'Booking removed from history successfully' });
  });
});

// USER SPECIFIC BOOKINGS
app.get('/mybookings/:userId', (req, res) => {
  const userId = req.params.userId;
  
  const query = `
    SELECT b.*, h.name as hallName 
    FROM bookings b 
    LEFT JOIN halls h ON b.hall_id = h.id 
    WHERE b.user_id = ? 
    ORDER BY b.created_at DESC
  `;
  
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// HALLS WITH BOOKING STATUS
app.get('/halls-with-bookings', (req, res) => {
  const query = `
    SELECT 
      h.*,
      GROUP_CONCAT(
        CASE 
          WHEN b.status = 'approved' 
          THEN CONCAT(b.date, '|', b.time, '|', b.id)
          ELSE NULL 
        END
      ) as booked_slots
    FROM halls h
    LEFT JOIN bookings b ON h.id = b.hall_id
    WHERE h.is_active = true
    GROUP BY h.id
    ORDER BY h.created_at DESC
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    const processedResults = results.map(hall => {
      const bookedDates = [];
      
      if (hall.booked_slots) {
        const slots = hall.booked_slots.split(',');
        slots.forEach(slot => {
          if (slot) {
            const [date, time, bookingId] = slot.split('|');
            bookedDates.push({
              date: date,
              time: time,
              bookingId: bookingId
            });
          }
        });
      }
      
      return {
        ...hall,
        bookedDates: bookedDates,
        booked_slots: undefined
      };
    });
    
    res.json(processedResults);
  });
});

// ADMIN HALLS MANAGEMENT
app.get('/admin/halls/all', (req, res) => {
  const query = 'SELECT * FROM halls ORDER BY is_active DESC, created_at DESC';
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

app.put('/admin/halls/:id/restore', (req, res) => {
  const hallId = req.params.id;
  
  const query = 'UPDATE halls SET is_active = true WHERE id = ?';
  db.query(query, [hallId], (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ success: true, message: 'Hall restored successfully' });
  });
});

// PASSWORD RESET ROUTES
app.post("/reset-password", (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  try {
    const checkUser = 'SELECT * FROM users WHERE email = ?';
    db.query(checkUser, [email], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(404).json({ success: false, message: 'Email not found' });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000);
      
      const updateToken = 'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?';
      db.query(updateToken, [resetToken, resetTokenExpiry, email], (err, result) => {
        if (err) {
          console.error('Token update error:', err);
          return res.status(500).json({ success: false, message: 'Failed to generate reset token' });
        }

        const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;
        const mailOptions = {
          from: 'shakoorhussain395@gmail.com',
          to: email,
          subject: 'Password Reset Request - Marriage Hall Booking',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Password Reset Request</h2>
              <p>You have requested to reset your password for your Marriage Hall Booking account.</p>
              <p>Click the button below to reset your password:</p>
              <a href="${resetUrl}" style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">Reset Password</a>
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="word-break: break-all;">${resetUrl}</p>
              <p><strong>Note:</strong> This link will expire in 1 hour for security purposes.</p>
              <p>If you didn't request this password reset, please ignore this email.</p>
            </div>
          `
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Email sending failed:', error);
            return res.status(500).json({ success: false, message: 'Failed to send reset email: ' + error.message });
          }
          
          res.json({ success: true, message: 'Password reset link sent to your email' });
        });
      });
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

app.get("/verify-reset-token/:token", (req, res) => {
  const { token } = req.params;
  
  const query = 'SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()';
  db.query(query, [token], (err, results) => {
    if (err) {
      console.error('Token verification error:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    res.json({ success: true, message: 'Valid reset token', email: results[0].email });
  });
});

app.post("/update-password", (req, res) => {
  const { token, newPassword } = req.body;
  
  if (!token || !newPassword) {
    return res.status(400).json({ success: false, message: 'Token and new password are required' });
  }

  try {
    const verifyToken = 'SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()';
    db.query(verifyToken, [token], (err, results) => {
      if (err) {
        console.error('Token verification error:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
      }

      const hashedPassword = newPassword;
      const updatePassword = 'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE reset_token = ?';
      
      db.query(updatePassword, [hashedPassword, token], (err, result) => {
        if (err) {
          console.error('Password update error:', err);
          return res.status(500).json({ success: false, message: 'Failed to update password' });
        }

        res.json({ success: true, message: 'Password updated successfully' });
      });
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// BOOKING EMAIL CONFIRMATION
app.post('/sendBookingEmail', async (req, res) => {
  const { to, subject, bookingDetails } = req.body;
  
  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #28a745;">Marriage Hall Booking Confirmation</h2>
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Hall Name:</strong> ${bookingDetails.hallName}</p>
        <p><strong>Location:</strong> ${bookingDetails.location}</p>
        <p><strong>Time:</strong> ${bookingDetails.time}</p>
        <p><strong>Capacity:</strong> ${bookingDetails.capacity}</p>
        <p><strong>Price:</strong> ${bookingDetails.price} PKR</p>
        <p><strong>Contact Admin:</strong> +92-301-1234567</p>
      </div>
      <p>Thank you for booking with us! Please proceed with payment to confirm your booking.</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: 'shakoorhussain395@gmail.com',
      to,
      subject,
      html: message,
    });
    res.status(200).json({ success: true, message: 'Booking confirmation email sent!' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Email sending failed.', error });
  }
});

// AUTHENTICATION ROUTES
app.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body;
  
  try {
    const checkUser = 'SELECT * FROM users WHERE email = ?';
    db.query(checkUser, [email], async (err, results) => {
      if (err) {
        return res.json({ success: false, message: 'Database error' });
      }
      
      if (results.length > 0) {
        return res.json({ success: false, message: 'Email already exists' });
      }
      
      const hashedPassword = password;
      
      const insertUser = 'INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)';
      db.query(insertUser, [name, email, hashedPassword, phone, 'user'], (err, result) => {
        if (err) {
          return res.json({ success: false, message: 'Registration failed' });
        }
        res.json({ success: true, message: 'User registered successfully' });
      });
    });
  } catch (error) {
    res.json({ success: false, message: 'Server error' });
  }
});

app.post('/login', (req, res) => {
  const { email, password, role } = req.body;
  
  const query = 'SELECT * FROM users WHERE email = ? AND role = ?';
  db.query(query, [email, role], async (err, results) => {
    if (err) {
      return res.json({ success: false, message: 'Database error' });
    }
    
    if (results.length === 0) {
      return res.json({ success: false, message: 'Invalid credentials' });
    }
    
    const user = results[0];
    
    const passwordMatch = password === user.password;
    if (!passwordMatch) {
      return res.json({ success: false, message: 'Invalid credentials' });
    }
    
    delete user.password;
    
    res.json({ 
      success: true, 
      message: 'Login successful', 
      user: user 
    });
  });
});

// HALL ROUTES
app.get('/halls', (req, res) => {
  const query = 'SELECT * FROM halls WHERE is_active = true ORDER BY created_at DESC';
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// BOOKING ROUTES
app.post('/bookings', (req, res) => {
  const { userId, hallId, hallName, date, time, guests, eventType, specialRequests, totalPrice } = req.body;
  
  const checkBooking = 'SELECT * FROM bookings WHERE hall_id = ? AND date = ? AND time = ? AND status = "approved"';
  db.query(checkBooking, [hallId, date, time], (err, results) => {
    if (err) {
      return res.json({ success: false, message: 'Database error' });
    }
    
    if (results.length > 0) {
      return res.json({ success: false, message: 'Hall is already booked for this date and time' });
    }
    
    const insertBooking = `
      INSERT INTO bookings (user_id, hall_id, hall_name, date, time, guests, event_type, special_requests, total_price, payment_status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `;
    
    db.query(insertBooking, [userId, hallId, hallName, date, time, guests, eventType, specialRequests, totalPrice], (err, result) => {
      if (err) {
        return res.json({ success: false, message: 'Booking failed' });
      }
      res.json({ success: true, message: 'Booking created successfully' });
    });
  });
});

app.delete('/bookings/:id', (req, res) => {
  const bookingId = req.params.id;
  
  const query = 'DELETE FROM bookings WHERE id = ?';
  db.query(query, [bookingId], (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ success: false, message: 'Failed to cancel booking' });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    res.json({ success: true, message: 'Booking cancelled successfully' });
  });
});

// ADMIN ROUTES
app.get('/admin/bookings', (req, res) => {
  const query = `
    SELECT b.*, u.name as userName, u.email as userEmail, h.location as hallLocation
    FROM bookings b 
    JOIN users u ON b.user_id = u.id 
    LEFT JOIN halls h ON b.hall_id = h.id
    ORDER BY b.created_at DESC
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

app.put('/admin/bookings/:id', (req, res) => {
  const bookingId = req.params.id;
  const { status } = req.body;
  
  const query = 'UPDATE bookings SET status = ? WHERE id = ?';
  db.query(query, [status, bookingId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ success: true, message: 'Booking status updated' });
  });
});

app.get('/admin/halls', (req, res) => {
  const query = 'SELECT * FROM halls WHERE is_active = true ORDER BY created_at DESC';
  
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

app.post('/admin/halls', (req, res) => {
  const { name, description, capacity, location, price, contact, image } = req.body;
  
  const query = `
    INSERT INTO halls (name, description, capacity, location, price, contact, image) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.query(query, [name, description, capacity, location, price, contact, image], (err, result) => {
    if (err) {
      return res.json({ success: false, message: 'Failed to add hall' });
    }
    res.json({ success: true, message: 'Hall added successfully' });
  });
});

app.put('/admin/halls/:id', (req, res) => {
  const hallId = req.params.id;
  const { name, description, capacity, location, price, contact, image } = req.body;
  
  const query = `
    UPDATE halls 
    SET name = ?, description = ?, capacity = ?, location = ?, price = ?, contact = ?, image = ? 
    WHERE id = ?
  `;
  
  db.query(query, [name, description, capacity, location, price, contact, image, hallId], (err, result) => {
    if (err) {
      return res.json({ success: false, message: 'Failed to update hall' });
    }
    res.json({ success: true, message: 'Hall updated successfully' });
  });
});

app.delete('/admin/halls/:id', (req, res) => {
  const hallId = req.params.id;
  
  const query = 'UPDATE halls SET is_active = false WHERE id = ?';
  db.query(query, [hallId], (err, result) => {
    if (err) {
      return res.json({ success: false, message: 'Failed to delete hall' });
    }
    res.json({ success: true, message: 'Hall deleted successfully' });
  });
});

// TEST ROUTE
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working!', timestamp: new Date() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running at port ${PORT}`);
  console.log(`Test the server at: http://localhost:${PORT}/test`);
});