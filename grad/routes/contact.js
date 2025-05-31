const express = require('express');
const router = express.Router();
const { Resend } = require('resend');

const resend = new Resend('re_FAA82UX5_LGeKKY9kC8sAk6iVTPfbNuFc');
const ADMIN_EMAIL = 'markbookkraiton@gmail.com';

// POST /api/contact/submit
router.post('/submit', async (req, res) => {
  try {
    const { fullName, phoneNumber, emailAddress, message } = req.body;

    if (!fullName || !phoneNumber || !emailAddress || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'All fields are required' 
      });
    }

    if (fullName.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name must be at least 2 characters' 
      });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(emailAddress)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please enter a valid email address' 
      });
    }

    const phonePattern = /^[\d\s\-\+\(\)]{10,}$/;
    if (!phonePattern.test(phoneNumber)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please enter a valid phone number' 
      });
    }

    if (message.trim().length < 10) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message must be at least 10 characters' 
      });
    }

    // Send email notification to admin
    const adminEmailResult = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: ADMIN_EMAIL,
      subject: `New Contact Message from ${fullName}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; background-color: #f8f9fa;">
          <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #19497b; margin-bottom: 20px; border-bottom: 2px solid #19497b; padding-bottom: 10px;">
              📧 New Contact Message
            </h2>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #19497b; margin-top: 0;">Contact Details:</h3>
              <p style="margin: 10px 0;"><strong>Name:</strong> ${escapeHtml(fullName)}</p>
              <p style="margin: 10px 0;"><strong>Email:</strong> <a href="mailto:${emailAddress}" style="color: #19497b;">${emailAddress}</a></p>
              <p style="margin: 10px 0;"><strong>Phone:</strong> <a href="tel:${phoneNumber}" style="color: #19497b;">${phoneNumber}</a></p>
              <p style="margin: 10px 0;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            <div style="background: #fff; padding: 20px; border-left: 4px solid #19497b; margin: 20px 0; border-radius: 0 8px 8px 0;">
              <h3 style="margin-top: 0; color: #19497b;">Message:</h3>
              <div style="line-height: 1.6; white-space: pre-wrap; background: #f8f9fa; padding: 15px; border-radius: 4px;">${escapeHtml(message)}</div>
            </div>
            
            <div style="margin-top: 30px; padding: 15px; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #2196f3;">
              <p style="margin: 0; color: #1976d2; font-size: 14px;">
                💡 <strong>Quick Actions:</strong><br>
                • Reply directly to this email to respond to the customer<br>
                • Call them at <a href="tel:${phoneNumber}" style="color: #1976d2;">${phoneNumber}</a><br>
                • Add to CRM or contact management system
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px; text-align: center;">
              This message was sent from the School Advisor contact form at ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
      `
    });

    // Send confirmation email to user
    const userEmailResult = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: emailAddress,
      subject: 'Thank you for contacting School Advisor',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; background-color: #f8f9fa;">
          <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #19497b; margin-bottom: 10px;">Thank You for Contacting Us! 🎓</h1>
              <div style="width: 50px; height: 3px; background: #19497b; margin: 0 auto;"></div>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6;">Dear <strong>${escapeHtml(fullName)}</strong>,</p>
            
            <p style="line-height: 1.6;">Thank you for reaching out to <strong>School Advisor</strong>! We have received your message and our team will get back to you within <strong>24 hours</strong>.</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #19497b;">
              <h3 style="margin-top: 0; color: #19497b;">📝 Your Message:</h3>
              <div style="background: white; padding: 15px; border-radius: 4px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(message)}</div>
            </div>
            
            <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="margin-top: 0; color: #2e7d32;">🎯 While You Wait:</h3>
              <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.8;">
                <li>Explore our <strong>school search platform</strong> to find the perfect school for your child</li>
                <li>Read reviews and ratings from other parents</li>
                <li>Check out our <strong>GPS tracking feature</strong> for school buses</li>
                <li>Book appointments directly with schools</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="http://localhost:5501/index.html" style="background: #19497b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                🏠 Visit Our Platform
              </a>
            </div>
            
            <div style="border-top: 2px solid #19497b; padding-top: 20px; margin-top: 30px;">
              <p style="margin: 0; line-height: 1.6;">
                Best regards,<br>
                <strong style="color: #19497b;">The School Advisor Team</strong><br>
                <span style="color: #666; font-size: 14px;">Making school selection simple and smart</span>
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">
              This is an automated confirmation email. Please do not reply directly to this message.<br>
              If you need immediate assistance, please call us or visit our website.
            </p>
          </div>
        </div>
      `
    });

    console.log('Contact emails sent successfully:', {
      adminEmail: !!adminEmailResult.data?.id,
      userEmail: !!userEmailResult.data?.id
    });

    res.status(200).json({
      success: true,
      message: 'Thank you for your message! We will get back to you within 24 hours.'
    });

  } catch (error) {
    console.error('Error processing contact form:', error);
    
    let errorMessage = 'Failed to send message. Please try again later.';
    
    if (error.message?.includes('network') || error.code === 'ENOTFOUND') {
      errorMessage = 'Network error. Please check your connection and try again.';
    } else if (error.message?.includes('rate limit')) {
      errorMessage = 'Too many requests. Please wait a moment and try again.';
    }

    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

module.exports = router;