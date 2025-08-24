const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());

// Configure CORS - Fixed: removed trailing slash and added multiple origins
app.use(cors({
  origin: [
    'https://portfolio-alpha-seven-38.vercel.app', // ✅ No trailing slash
    'http://localhost:3000', // For local development
    'http://localhost:5173', // For Vite dev server
  ],
  methods: ['GET', 'POST'],
  credentials: true,
}));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    endpoints: ['/send-message']
  });
});

// Test endpoint to check environment variables
app.get('/test', (req, res) => {
  res.json({
    emailConfigured: !!process.env.EMAIL_USER && !!process.env.EMAIL_PASS,
    emailUser: process.env.EMAIL_USER ? 'Configured' : 'Missing',
    emailPass: process.env.EMAIL_PASS ? 'Configured' : 'Missing',
  });
});

// Contact form endpoint
app.post('/send-message', async (req, res) => {
  console.log('Received contact form submission:', { 
    body: req.body, 
    headers: req.headers 
  });

  const { name, email, message } = req.body;

  // Enhanced validation
  if (!name || !email || !message) {
    console.log('Validation failed - missing fields');
    return res.status(400).json({ 
      error: 'All fields are required',
      received: { name: !!name, email: !!email, message: !!message }
    });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.log('Validation failed - invalid email format');
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Check environment variables
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('Environment variables missing:', {
      EMAIL_USER: !!process.env.EMAIL_USER,
      EMAIL_PASS: !!process.env.EMAIL_PASS
    });
    return res.status(500).json({ 
      error: 'Server configuration error - email credentials not configured' 
    });
  }

  try {
    console.log('Attempting to send email...');
    
    // Configure Nodemailer transporter with better error handling
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      // Additional configuration for better reliability
      pool: true,
      maxConnections: 1,
      rateDelta: 20000,
      rateLimit: 5,
    });

    // Verify transporter configuration
    await transporter.verify();
    console.log('SMTP configuration verified');

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER, // Use your email as sender
      to: process.env.EMAIL_USER,   // Send to yourself
      replyTo: email,               // Set reply-to as the form submitter
      subject: `Portfolio Contact: Message from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
            New Portfolio Contact Message
          </h2>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          </div>
          <div style="margin: 20px 0;">
            <h3 style="color: #374151;">Message:</h3>
            <div style="background: white; padding: 15px; border-left: 4px solid #2563eb; margin: 10px 0;">
              ${message.replace(/\n/g, '<br>')}
            </div>
          </div>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">
            This message was sent from your portfolio contact form.
          </p>
        </div>
      `,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);

    res.status(200).json({ 
      message: 'Message sent successfully!',
      messageId: info.messageId 
    });

  } catch (error) {
    console.error('Error sending email:', error);
    
    // More specific error messages
    let errorMessage = 'Failed to send message';
    
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed - check your Gmail app password';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Network error - unable to connect to email service';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Connection error - please try again later';
    }

    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/`);
  console.log('Email config status:', {
    EMAIL_USER: !!process.env.EMAIL_USER,
    EMAIL_PASS: !!process.env.EMAIL_PASS
  });
});
