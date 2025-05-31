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

// Student confirmation email endpoint
app.post('/send-student-confirmation', async (req, res) => {
  try {
    const { parentName, parentEmail, studentName, studentId, schoolName, studentGrade } = req.body;

    if (!parentName || !parentEmail || !studentName || !studentId || !schoolName) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(parentEmail)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    // Send parent confirmation email
    const parentResult = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: parentEmail,
      subject: `School Selection Confirmed - Student ID: ${studentId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1b3865; margin-bottom: 10px;">School Selection Confirmed!</h1>
              <div style="width: 60px; height: 4px; background-color: #007BFF; margin: 0 auto;"></div>
            </div>
            
            <p style="color: #333; font-size: 16px; line-height: 1.6;">Dear ${parentName},</p>
            
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              Thank you for selecting <strong>${schoolName}</strong> for your child. We're excited to have ${studentName} join our school community!
            </p>
            
            <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #007BFF;">
              <h3 style="color: #1b3865; margin-top: 0;">Important: Your Student Tracking ID</h3>
              <div style="font-size: 24px; font-weight: bold; color: #007BFF; text-align: center; padding: 10px; background-color: white; border-radius: 6px; margin: 15px 0;">
                ${studentId}
              </div>
              <p style="color: #666; font-size: 14px; margin-bottom: 0;">
                <strong>Keep this ID safe!</strong> Use it to track your child's school bus in real-time through our tracking system.
              </p>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="color: #1b3865; margin-top: 0;">Student Information</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Student Name:</td>
                  <td style="padding: 8px 0; color: #333;">${studentName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Grade:</td>
                  <td style="padding: 8px 0; color: #333;">${studentGrade}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">School:</td>
                  <td style="padding: 8px 0; color: #333;">${schoolName}</td>
                </tr>
              </table>
            </div>
            
            <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #ffc107;">
              <h3 style="color: #856404; margin-top: 0;">Next Steps</h3>
              <ol style="color: #856404; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 10px;">Visit our <strong>Bus Tracking System</strong> and enter your Student ID</li>
                <li style="margin-bottom: 10px;">Complete enrollment forms (school will contact you)</li>
                <li style="margin-bottom: 10px;">Arrange school visit if needed</li>
                <li>Prepare for the new academic year!</li>
              </ol>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="http://localhost:5501/tracking.html" 
                 style="background-color: #007BFF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Track School Bus Now
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              If you have any questions, please contact the school administration.<br>
              This is an automated message from School Advisor.
            </p>
          </div>
        </div>
      `
    });

    // Send notification to school admin
    const adminResult = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: SCHOOL_EMAIL,
      subject: `New Student Registration: ${studentName} - ${schoolName}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1 style="color: #1b3865;">New Student Registration</h1>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Student Details</h3>
            <p><strong>Student ID:</strong> ${studentId}</p>
            <p><strong>Student Name:</strong> ${studentName}</p>
            <p><strong>Grade:</strong> ${studentGrade}</p>
            <p><strong>School:</strong> ${schoolName}</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Parent Details</h3>
            <p><strong>Parent Name:</strong> ${parentName}</p>
            <p><strong>Email:</strong> ${parentEmail}</p>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Registration completed at: ${new Date().toLocaleString()}
          </p>
        </div>
      `
    });

    const parentSuccess = parentResult.data?.id;
    const adminSuccess = adminResult.data?.id;

    if (parentSuccess && adminSuccess) {
      res.json({ 
        success: true, 
        message: 'Student confirmation emails sent successfully',
        emailsSent: {
          parent: parentSuccess,
          admin: adminSuccess
        }
      });
    } else {
      res.json({ 
        success: false, 
        error: 'Some emails failed to send',
        emailsSent: {
          parent: parentSuccess || null,
          admin: adminSuccess || null
        }
      });
    }

  } catch (error) {
    console.error('Error sending student confirmation email:', error);
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