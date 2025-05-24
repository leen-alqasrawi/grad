const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
const PORT = 5001;

console.log('🚀 Starting email server...');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize Resend
const resend = new Resend('re_FAA82UX5_LGeKKY9kC8sAk6iVTPfbNuFc');

// Store server reference for proper shutdown
let server;

// 🔥 IMPORTANT: Your school email
const SCHOOL_EMAIL = 'markbookkraiton@gmail.com';

// Validate school email on startup
if (SCHOOL_EMAIL.includes('example.com') || SCHOOL_EMAIL === 'your-school-email@example.com') {
  console.log('⚠️  WARNING: Please update SCHOOL_EMAIL in the server code!');
  console.log('   Current value:', SCHOOL_EMAIL);
  console.log('   Change line 20 to your actual email address');
} else {
  console.log('✅ School email configured:', SCHOOL_EMAIL);
}

// Graceful shutdown function
function gracefulShutdown(signal) {
  console.log(`\n📱 Received ${signal}. Shutting down gracefully...`);
  
  if (server) {
    server.close((err) => {
      if (err) {
        console.error('❌ Error during server shutdown:', err);
        process.exit(1);
      } else {
        console.log('✅ Server closed successfully. Goodbye! 👋');
        process.exit(0);
      }
    });
    
    // Force exit after 5 seconds if graceful shutdown fails
    setTimeout(() => {
      console.log('⚠️ Forcing shutdown after timeout...');
      process.exit(1);
    }, 5000);
  } else {
    console.log('✅ No server to close. Goodbye! 👋');
    process.exit(0);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Error handling
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('🚨 Unhandled Rejection:', reason);
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
    schoolEmail: SCHOOL_EMAIL.includes('example.com') ? 'NOT_CONFIGURED' : 'CONFIGURED'
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    status: 'Server is running perfectly',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())} seconds`,
    memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
    schoolEmail: SCHOOL_EMAIL
  });
});

// Main appointment emails endpoint - UPDATED VERSION
app.post('/send-appointment-emails', async (req, res) => {
  console.log('📧 Processing appointment email request...');
  
  try {
    const { 
      parentName, 
      studentName, 
      phone, 
      email, 
      grade, 
      appointmentDate, 
      preferredTime, 
      notes 
    } = req.body;

    console.log('🔍 Received parent email:', email);
    console.log('🔍 Email type:', typeof email);
    console.log('🔍 Email length:', email?.length);

    // Validation
    if (!parentName || !studentName || !phone || !email || !grade || !appointmentDate || !preferredTime) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        receivedFields: { parentName: !!parentName, studentName: !!studentName, phone: !!phone, email: !!email, grade: !!grade, appointmentDate: !!appointmentDate, preferredTime: !!preferredTime }
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('❌ Invalid email format:', email);
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
        receivedEmail: email
      });
    }

    // Check if school email is configured
    if (SCHOOL_EMAIL.includes('example.com') || SCHOOL_EMAIL === 'your-school-email@example.com') {
      console.log('❌ School email not configured properly');
      return res.status(500).json({
        success: false,
        error: 'School email not configured. Please update SCHOOL_EMAIL in server code.',
        details: {
          message: 'Admin email cannot be sent to placeholder address',
          currentEmail: SCHOOL_EMAIL
        }
      });
    }

    // Format date and time
    let formattedDate, formattedTime;
    try {
      formattedDate = new Date(appointmentDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      formattedTime = new Date(`2000-01-01T${preferredTime}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      formattedDate = appointmentDate;
      formattedTime = preferredTime;
    }

    console.log('📤 About to send emails...');
    console.log('   Parent email:', email);
    console.log('   School email:', SCHOOL_EMAIL);

    // Send parent email first with detailed logging
    console.log('📧 Sending parent email...');
    let parentResult;
    try {
      parentResult = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: email,
        subject: '✅ Appointment Request Confirmed - We\'ll Contact You Soon!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #007BFF;">✅ Appointment Confirmed</h1>
            <p>Dear ${parentName},</p>
            <p>Thank you for your appointment request for <strong>${studentName}</strong>.</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>📅 Appointment Details</h3>
              <p><strong>Student:</strong> ${studentName}</p>
              <p><strong>Grade:</strong> ${grade}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${formattedTime}</p>
              <p><strong>Phone:</strong> ${phone}</p>
              ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
            </div>
            
            <p>We will contact you within 24 hours to confirm the details.</p>
            <p>Thank you for choosing our school!</p>
          </div>
        `
      });
      
      console.log('✅ Parent email result:', parentResult);
      
    } catch (parentError) {
      console.error('❌ Parent email failed:', parentError);
      parentResult = { error: parentError };
    }

    // Send admin email with detailed logging
    console.log('📧 Sending admin email...');
    let adminResult;
    try {
      adminResult = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: SCHOOL_EMAIL,
        reply_to: email,
        subject: `🚨 NEW APPOINTMENT: ${parentName} - ${studentName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #d32f2f;">🚨 NEW APPOINTMENT REQUEST</h1>
            
            <div style="background: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2>Contact Required</h2>
              <p><strong>${parentName}</strong> is waiting for your call!</p>
              <p>📞 <a href="tel:${phone}">${phone}</a></p>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>📅 Appointment Details</h3>
              <p><strong>Parent:</strong> ${parentName}</p>
              <p><strong>Student:</strong> ${studentName}</p>
              <p><strong>Grade:</strong> ${grade}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${formattedTime}</p>
              <p><strong>Phone:</strong> <a href="tel:${phone}">${phone}</a></p>
              <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
              ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
            </div>
            
            <p>Please contact them within 24 hours to confirm the appointment.</p>
          </div>
        `
      });
      
      console.log('✅ Admin email result:', adminResult);
      
    } catch (adminError) {
      console.error('❌ Admin email failed:', adminError);
      adminResult = { error: adminError };
    }

    // Process results with detailed logging
    const parentSuccess = parentResult && !parentResult.error && parentResult.data;
    const adminSuccess = adminResult && !adminResult.error && adminResult.data;
    
    console.log('📊 Email sending summary:');
    console.log('   Parent email success:', parentSuccess);
    console.log('   Parent email ID:', parentResult?.data?.id);
    console.log('   Parent email error:', parentResult?.error?.message);
    console.log('   Admin email success:', adminSuccess);
    console.log('   Admin email ID:', adminResult?.data?.id);
    console.log('   Admin email error:', adminResult?.error?.message);

    if (parentSuccess && adminSuccess) {
      console.log('✅ Both emails sent successfully');
      res.json({
        success: true,
        message: 'Both emails sent successfully',
        parentEmailId: parentResult.data.id,
        adminEmailId: adminResult.data.id,
        debug: {
          parentEmail: email,
          schoolEmail: SCHOOL_EMAIL,
          parentResult: parentResult.data,
          adminResult: adminResult.data
        }
      });
    } else if (adminSuccess && !parentSuccess) {
      console.log('⚠️ Only admin email sent, parent email failed');
      res.json({
        success: false,
        error: 'Parent email failed to send',
        adminEmailId: adminResult.data.id,
        parentError: parentResult?.error?.message || 'Unknown error',
        debug: {
          parentEmail: email,
          parentAttempted: true,
          parentSuccess: false,
          adminSuccess: true
        }
      });
    } else if (parentSuccess && !adminSuccess) {
      console.log('⚠️ Only parent email sent, admin email failed');
      res.json({
        success: false,
        error: 'Admin email failed to send',
        parentEmailId: parentResult.data.id,
        adminError: adminResult?.error?.message || 'Unknown error',
        debug: {
          parentSuccess: true,
          adminSuccess: false
        }
      });
    } else {
      console.log('❌ Both emails failed');
      res.status(500).json({
        success: false,
        error: 'Both emails failed to send',
        parentError: parentResult?.error?.message || 'Unknown error',
        adminError: adminResult?.error?.message || 'Unknown error',
        debug: {
          parentSuccess: false,
          adminSuccess: false
        }
      });
    }

  } catch (error) {
    console.error('❌ Error in appointment endpoint:', error.message);
    res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
});

// Simple email testing endpoint
app.post('/test-simple-email', async (req, res) => {
  console.log('🧪 Testing simple email sending...');
  
  try {
    const { testEmail } = req.body;
    
    if (!testEmail) {
      return res.status(400).json({
        success: false,
        error: 'Please provide testEmail in request body'
      });
    }
    
    console.log('📧 Sending test email to:', testEmail);
    
    // Send a very simple test email
    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: testEmail,
      subject: 'Test Email - Please Check Your Inbox',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px;">
          <h1 style="color: #007BFF;">🧪 Email Test Successful!</h1>
          <p>If you received this email, your email system is working correctly.</p>
          <p><strong>Test Time:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Sent to:</strong> ${testEmail}</p>
          <div style="background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Next Steps:</strong></p>
            <ul>
              <li>✅ Your email server is working</li>
              <li>✅ Resend API is sending emails</li>
              <li>✅ Emails are reaching your inbox</li>
            </ul>
          </div>
          <p>You can now use the appointment form with confidence!</p>
        </div>
      `
    });

    console.log('✅ Test email result:', result);

    if (result.error) {
      console.error('❌ Test email failed:', result.error);
      return res.status(500).json({
        success: false,
        error: result.error,
        message: 'Resend API returned an error'
      });
    }

    res.json({
      success: true,
      message: 'Test email sent successfully',
      emailId: result.data?.id,
      sentTo: testEmail,
      checkInstructions: 'Check your inbox (and spam folder) for the test email'
    });

  } catch (error) {
    console.error('❌ Test email error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug parent email specifically
app.post('/debug-parent-email', async (req, res) => {
  console.log('🔍 Debugging parent email specifically...');
  
  try {
    const { 
      parentName, 
      studentName, 
      phone, 
      email, 
      grade, 
      appointmentDate, 
      preferredTime, 
      notes 
    } = req.body;

    console.log('📧 Parent email details:');
    console.log('   Email address:', email);
    console.log('   Email length:', email?.length);
    console.log('   Email type:', typeof email);
    console.log('   Has @ symbol:', email?.includes('@'));
    console.log('   Has dot:', email?.includes('.'));

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValidEmail = emailRegex.test(email);
    console.log('   Is valid format:', isValidEmail);

    if (!isValidEmail) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
        emailReceived: email
      });
    }

    // Try sending a very simple email first
    console.log('📤 Sending simple test email to parent...');
    
    const simpleResult = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Simple Test - Please Confirm Receipt',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>📧 Email Test Successful</h1>
          <p>Hello ${parentName},</p>
          <p>This is a simple test email to confirm your email address is working.</p>
          <p><strong>Time sent:</strong> ${new Date().toLocaleString()}</p>
          <p>If you receive this, please reply or let us know!</p>
        </div>
      `
    });

    console.log('✅ Simple email result:', simpleResult);

    if (simpleResult.error) {
      return res.status(500).json({
        success: false,
        error: 'Simple email failed',
        details: simpleResult.error
      });
    }

    // Now try the full appointment email
    console.log('📤 Sending full appointment email...');

    const formattedDate = new Date(appointmentDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const formattedTime = new Date(`2000-01-01T${preferredTime}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const fullResult = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: '✅ Appointment Request Confirmed - We\'ll Contact You Soon!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #007BFF;">✅ Appointment Confirmed</h1>
          <p>Dear ${parentName},</p>
          <p>Thank you for your appointment request for <strong>${studentName}</strong>.</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>📅 Appointment Details</h3>
            <p><strong>Student:</strong> ${studentName}</p>
            <p><strong>Grade:</strong> ${grade}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Time:</strong> ${formattedTime}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
          </div>
          
          <p>We will contact you within 24 hours to confirm the details.</p>
          <p>Thank you for choosing our school!</p>
        </div>
      `
    });

    console.log('📧 Full email result:', fullResult);

    res.json({
      success: true,
      message: 'Parent email debug completed',
      emailAddress: email,
      emailValidation: {
        isValid: isValidEmail,
        hasAtSymbol: email?.includes('@'),
        hasDot: email?.includes('.'),
        length: email?.length
      },
      simpleEmailResult: {
        success: !simpleResult.error,
        emailId: simpleResult.data?.id,
        error: simpleResult.error
      },
      fullEmailResult: {
        success: !fullResult.error,
        emailId: fullResult.data?.id,
        error: fullResult.error
      },
      instructions: [
        'Check your email inbox for the simple test email',
        'Check your spam folder for both emails',
        'Check the full appointment email',
        'Note which emails arrive and which don\'t'
      ]
    });

  } catch (error) {
    console.error('❌ Parent email debug error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test specific email address
app.post('/test-email-address', async (req, res) => {
  console.log('🧪 Testing specific email address...');
  
  try {
    const { testEmail, testName } = req.body;
    
    if (!testEmail) {
      return res.status(400).json({
        success: false,
        error: 'testEmail is required'
      });
    }

    console.log('📧 Testing email to:', testEmail);

    // Send multiple test emails with different content
    const tests = await Promise.allSettled([
      // Test 1: Super simple email
      resend.emails.send({
        from: 'onboarding@resend.dev',
        to: testEmail,
        subject: 'Test 1: Simple Email',
        html: '<h1>Test 1</h1><p>Simple email test.</p>'
      }),

      // Test 2: Medium complexity
      resend.emails.send({
        from: 'onboarding@resend.dev',
        to: testEmail,
        subject: 'Test 2: Medium Email',
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h1>Test 2</h1>
            <p>Hello ${testName || 'there'},</p>
            <p>This is a medium complexity email test.</p>
          </div>
        `
      }),

      // Test 3: Full styled email (like appointment)
      resend.emails.send({
        from: 'onboarding@resend.dev',
        to: testEmail,
        subject: 'Test 3: Full Styled Email',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #007BFF;">Test 3: Full Email</h1>
            <p>Dear ${testName || 'Friend'},</p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Test Details</h3>
              <p><strong>Test Type:</strong> Full styled email</p>
              <p><strong>Purpose:</strong> Check if styling affects delivery</p>
            </div>
            <p>If you receive this, full emails work fine!</p>
          </div>
        `
      })
    ]);

    const results = tests.map((test, index) => ({
      testNumber: index + 1,
      success: test.status === 'fulfilled',
      emailId: test.status === 'fulfilled' ? test.value?.data?.id : null,
      error: test.status === 'rejected' ? test.reason?.message : null
    }));

    console.log('📊 Test results:', results);

    res.json({
      success: true,
      message: 'Email address tests completed',
      testedEmail: testEmail,
      results: results,
      instructions: [
        'Check your inbox for 3 test emails',
        'Check your spam folder as well',
        'Note which test emails arrive',
        'This will help identify if it\'s a content or delivery issue'
      ]
    });

  } catch (error) {
    console.error('❌ Email address test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Email status check endpoint
app.get('/check-email-status/:emailId', async (req, res) => {
  console.log('🔍 Checking email status...');
  
  try {
    const { emailId } = req.params;
    
    if (!emailId) {
      return res.status(400).json({
        success: false,
        error: 'Email ID is required'
      });
    }

    // Note: Resend doesn't provide a status check API in their basic plan
    // This is a placeholder for future functionality
    res.json({
      success: true,
      message: 'Email status check not available with current Resend plan',
      emailId: emailId,
      tip: 'Check your inbox and spam folder manually'
    });

  } catch (error) {
    console.error('❌ Status check error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Resend account info endpoint
app.get('/resend-info', async (req, res) => {
  console.log('📊 Checking Resend account info...');
  
  try {
    // Try to get account info (this might not work with all API keys)
    res.json({
      message: 'Resend API key is configured',
      apiKey: 're_FAA82UX5_LG***' + '(hidden)',
      fromDomain: 'onboarding@resend.dev (Resend test domain)',
      tips: [
        'Emails from onboarding@resend.dev might go to spam',
        'Check your Resend dashboard at resend.com',
        'Verify your email address in Resend if needed',
        'New accounts might be in sandbox mode'
      ]
    });

  } catch (error) {
    console.error('❌ Resend info error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
server = app.listen(PORT, () => {
  console.log('🎉 ========================================');
  console.log(`🚀 Email server running on http://localhost:${PORT}`);
  console.log(`🕒 Started at: ${new Date().toLocaleString()}`);
  console.log('📧 Ready to send appointment emails!');
  if (SCHOOL_EMAIL.includes('example.com')) {
    console.log('⚠️  REMINDER: Update SCHOOL_EMAIL on line 20!');
  }
  console.log('🎉 ========================================');
  console.log('💡 Press Ctrl+C to stop the server');
});

server.on('error', (error) => {
  console.error('🚨 Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use!`);
    process.exit(1);
  }
});

console.log('✅ Server setup complete!');