// Secure email credential handling using dotenv

require('dotenv').config(); // Loads variables from .env

const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const EMAIL_TO = process.env.EMAIL_USER;

// Set up Nodemailer transporter with environment variables
const transporter = nodemailer.createTransport({
  service: 'Outlook',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Account request endpoint
app.post('/api/send-account-request', async (req, res) => {
  const { email, name, lastname, message } = req.body;
  if (!email || !name || !lastname || !message) {
    return res.json({ success: false, error: 'All fields are required.' });
  }
  const mailOpts = {
    from: `"Account Application" <${EMAIL_TO}>`,
    to: EMAIL_TO,
    subject: 'New Account Application',
    text: `Account application:\n\nEmail: ${email}\nName: ${name} ${lastname}\nMessage: ${message}\n`
  };
  try {
    await transporter.sendMail(mailOpts);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: 'Error sending email. Please check server logs.' });
  }
});

// Password reset endpoint
app.post('/api/send-password-reset', async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.json({ success: false, error: 'All fields are required.' });
  }
  const mailOpts = {
    from: `"Password Reset Request" <${EMAIL_TO}>`,
    to: EMAIL_TO,
    subject: 'Password Reset Request',
    text: `Password reset request:\n\nName: ${name}\nEmail: ${email}\nMay take up to three days to process.\n`
  };
  try {
    await transporter.sendMail(mailOpts);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: 'Error sending email. Please check server logs.' });
  }
});

app.listen(3000, () => {
  console.log('Email server running on port 3000');
});
