const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();

app.use(cors());
app.use(express.json());

const resend = new Resend('re_FAA82UX5_LGeKKY9kC8sAk6iVTPfbNuFc');
const SCHOOL_EMAIL = 'markbookkraiton@gmail.com';

// Appointment emails endpoint
app.post('/send-appointment-emails', async (req, res) => {
  try {
    const { parentName, studentName, phone, email, grade, appointmentDate, preferredTime, notes } = req.body;

    if (!parentName || !studentName || !phone || !email || !grade || !appointmentDate || !preferredTime) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    const date = new Date(appointmentDate).toLocaleDateString();

    // send parent email
    const parentResult = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Appointment Confirmed',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>Appointment Confirmed</h1>
          <p>Dear ${parentName}, your appointment for ${studentName} has been confirmed.</p>
          <p><strong>Date:</strong> ${date}</p>
          <p><strong>Time:</strong> ${preferredTime}</p>
          <p><strong>Grade:</strong> ${grade}</p>
          <p>We will contact you within 24 hours.</p>
        </div>
      `
    });

    // send admin email
    const adminResult = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: SCHOOL_EMAIL,
      subject: `New Appointment: ${parentName}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>New Appointment</h1>
          <p><strong>Parent:</strong> ${parentName}</p>
          <p><strong>Student:</strong> ${studentName}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Date:</strong> ${date}</p>
          <p><strong>Time:</strong> ${preferredTime}</p>
          ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
        </div>
      `
    });

    const parentSuccess = parentResult.data?.id;
    const adminSuccess = adminResult.data?.id;

    if (parentSuccess && adminSuccess) {
      res.json({ success: true, message: 'Emails sent' });
    } else {
      res.json({ success: false, error: 'Some emails failed' });
    }

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generic email endpoint
app.post('/api/email/send-confirmation', async (req, res) => {
  try {
    const { to, subject, html } = req.body;

    const emailResult = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: to, 
      subject: subject, 
      html: html,
    });

    res.status(200).json({ success: true, result: emailResult });
  } catch (err) {
    console.error('Error sending email:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = app;