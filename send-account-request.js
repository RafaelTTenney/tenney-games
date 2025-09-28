// Node.js Express backend script (place in your server)
// Requires: npm install express nodemailer cors
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const EMAIL_TO = 'maintinence2025@outlook.com';

const transporter = nodemailer.createTransport({
  service: 'Outlook',
  auth: {
    user: 'maintinence2025@outlook.com',
    pass: 'YOUR_OUTLOOK_PASSWORD' // Replace with your Outlook email password or app password!
  }
});

app.post('/api/send-account-request', async (req, res) => {
  const { name, email, username } = req.body;
  if (!name || !email || !username) {
    return res.json({ success: false, error: 'All fields are required.' });
  }
  const mailOpts = {
    from: `"Account Request" <${EMAIL_TO}>`,
    to: EMAIL_TO,
    subject: 'New Account Application',
    text: `New user application:\n\nName: ${name}\nEmail: ${email}\nDesired Username: ${username}\n`
  };
  try {
    await transporter.sendMail(mailOpts);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: 'Error sending email. Please check server logs.' });
  }
});

app.listen(3000, () => {
  console.log('Account request email server running on port 3000');
});
