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
const PORT = process.env.PORT || 8081;

// Initialize Stripe with proper error handling
let stripe = null;
try {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error('STRIPE_SECRET_KEY environment variable is not set');
  } else if (!stripeKey.startsWith('sk_')) {
    console.error('STRIPE_SECRET_KEY must be a secret key (starts with sk_), got:', stripeKey.substring(0, 7) + '...');
  } else {
    stripe = new Stripe(stripeKey);
    console.log('Stripe initialized successfully');
  }
} catch (error) {
  console.error('Failed to initialize Stripe:', error.message);
}

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:5173', 
    'http://127.0.0.1:3000', 
    'http://127.0.0.1:5173',
    // Add your Vercel frontend URL here
    'https://your-frontend-domain.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Database connection with better error handling
let db = null;
try {
  const dbUrl = process.env.MYSQL_URL;
  if (!dbUrl) {
    console.error('MYSQL_URL environment variable is not set');
  } else {
    const dbConfig = new URL(dbUrl);
    
    // Log connection details (without password) for debugging
    console.log('Connecting to database:', {
      host: dbConfig.hostname,
      port: dbConfig.port,
      user: dbConfig.username,
      database: dbConfig.pathname.substring(1)
    });
    
    db = mysql.createConnection({
      host: dbConfig.hostname,
      port: dbConfig.port || 3306,
      user: dbConfig.username,
      password: dbConfig.password,
      database: dbConfig.pathname.substring(1),
      ssl: {
        rejectUnauthorized: false // Required for Railway
      },
      connectTimeout: 60000,
      acquireTimeout: 60000,
      timeout: 60000,
      reconnect: true
    });

    // Test database connection
    db.connect((err) => {
      if (err) {
        console.error('Database connection failed:', err);
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
        return;
      }
      console.log('Connected to MySQL database successfully');
    });

    // Handle connection errors
    db.on('error', (err) => {
      console.error('Database connection error:', err);
      if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('Attempting to reconnect to database...');
        // Handle reconnection logic if needed
      }
    });
  }
} catch (error) {
  console.error('Database initialization failed:', error);
  console.error('Make sure MYSQL_URL is properly formatted: mysql://user:password@host:port/database');
}
//helper functions 
// Add this helper function after your database connection
const executeQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database is not connected'));
      return;
    }
    
    db.query(query, params, (err, results) => {
      if (err) {
        console.error('Query error:', err);
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};
//testing railway connection 
app.get('/test-db', async (req, res) => {
  try {
    const result = await executeQuery('SELECT 1 as test');
    res.json({ 
      success: true, 
      message: 'Database connection successful',
      result 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Database connection failed',
      error: error.message 
    });
  }
});
// Email configuration
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: 'shakoorhussain395@gmail.com',
    pass: 'vbhgunaylrswqekb'
  }
});

// Initialize Gemini AI
let ai = null;
try {
  const geminiKey = process.env.GeminiApiKey;
  if (!geminiKey) {
    console.error('GeminiApiKey environment variable is not set');
  } else {
    ai = new GoogleGenAI({ apiKey: geminiKey });
    console.log('Gemini API Key loaded successfully');
  }
} catch (error) {
  console.error('Gemini initialization failed:', error);
}

// Health check route
app.get('/', (req, res) => {
  const status = {
    server: 'running',
    timestamp: new Date().toISOString(),
    environment: {
      stripe: !!stripe,
      database: !!db,
      gemini: !!ai
    }
  };
  res.json(status);
});

// STRIPE PAYMENT ROUTES
app.post('/create-payment-intent', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not properly configured' });
  }

  try {
    const { amount, bookingId, currency = 'pkr' } = req.body;

    if (!amount || !bookingId) {
      return res.status(400).json({ error: 'Amount and booking ID are required' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
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
  if (!stripe) {
    return res.status(500).json({ success: false, message: 'Stripe is not properly configured' });
  }

  if (!db) {
    return res.status(500).json({ success: false, message: 'Database is not connected' });
  }

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
  if (!db) {
    return res.status(500).json({ error: 'Database is not connected' });
  }

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
  if (!ai) {
    throw new Error('Gemini AI is not properly configured');
  }

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
  if (!ai) {
    return res.status(500).json({ error: 'Gemini AI is not properly configured' });
  }

  if (!db) {
    return res.status(500).json({ error: 'Database is not connected' });
  }

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

// Continue with all other routes but add db/stripe checks where needed...
// [Rest of your routes remain the same, just add null checks for db and stripe where needed]

// USER BOOKING HISTORY ROUTES
app.delete('/user/bookings/:id/remove', (req, res) => {
  if (!db) {
    return res.status(500).json({ success: false, message: 'Database is not connected' });
  }

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

// Add similar db checks for all other database routes...
// [I'll include a few more key routes with the fixes]

// USER SPECIFIC BOOKINGS
app.get('/mybookings/:userId', (req, res) => {
  if (!db) {
    return res.status(500).json({ error: 'Database is not connected' });
  }

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

// AUTHENTICATION ROUTES
app.post('/register', async (req, res) => {
  if (!db) {
    return res.json({ success: false, message: 'Database is not connected' });
  }

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
  if (!db) {
    return res.json({ success: false, message: 'Database is not connected' });
  }

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

// TEST ROUTE
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Server is working!', 
    timestamp: new Date(),
    status: {
      stripe: !!stripe,
      database: !!db,
      gemini: !!ai
    }
  });
});

// Export for Vercel
export default app;

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running at port ${PORT}`);
    console.log(`Test the server at: http://localhost:${PORT}/test`);
  });
}