document.getElementById('confirm').addEventListener('click', async function (e) {
  e.preventDefault();

  console.log('📧 Starting appointment submission...');

  // Get form elements
  const form = document.querySelector('form');
  const inputs = form.querySelectorAll('input');
  const select = form.querySelector('select');
  const textarea = form.querySelector('textarea');

  console.log('🔍 Form elements found:');
  console.log('   Total inputs:', inputs.length);
  console.log('   Select element:', !!select);
  console.log('   Textarea element:', !!textarea);

  // Log all inputs for debugging
  inputs.forEach((input, index) => {
    console.log(`   Input ${index + 1}:`, {
      type: input.type,
      placeholder: input.placeholder,
      value: input.value,
      length: input.value.length
    });
  });

  // Extract form data with detailed logging
  let parentName = '', studentName = '', phone = '', email = '', appointmentDate = '', preferredTime = '';
  
  inputs.forEach((input, index) => {
    const placeholder = input.placeholder.toLowerCase();
    console.log(`🔍 Processing input ${index + 1}:`, placeholder);
    
    if (placeholder.includes('parent')) {
      parentName = input.value.trim();
      console.log('   ✅ Found parent name:', parentName);
    } else if (placeholder.includes('student')) {
      studentName = input.value.trim();
      console.log('   ✅ Found student name:', studentName);
    } else if (input.type === 'tel' || placeholder.includes('phone')) {
      phone = input.value.trim();
      console.log('   ✅ Found phone:', phone);
    } else if (input.type === 'email') {
      email = input.value.trim();
      console.log('   ✅ Found email:', email);
      console.log('   📧 Email details:', {
        raw: input.value,
        trimmed: email,
        length: email.length,
        hasAt: email.includes('@'),
        hasDot: email.includes('.'),
        type: typeof email
      });
    } else if (input.type === 'date') {
      appointmentDate = input.value;
      console.log('   ✅ Found date:', appointmentDate);
    } else if (input.type === 'time') {
      preferredTime = input.value;
      console.log('   ✅ Found time:', preferredTime);
    } else {
      console.log('   ❓ Unmatched input:', {
        type: input.type,
        placeholder: placeholder,
        value: input.value
      });
    }
  });

  const grade = select ? select.value : '';
  const notes = textarea ? textarea.value.trim() : '';

  console.log('📝 Final extracted data:', {
    parentName: `"${parentName}"`,
    studentName: `"${studentName}"`,
    phone: `"${phone}"`,
    email: `"${email}"`,
    grade: `"${grade}"`,
    appointmentDate: `"${appointmentDate}"`,
    preferredTime: `"${preferredTime}"`,
    notes: `"${notes}"`
  });

  console.log('🚨 CRITICAL: Email address that will be sent to server:', {
    emailValue: email,
    emailLength: email.length,
    isEmpty: email === '',
    isUndefined: email === undefined,
    isNull: email === null
  });

  // Validation with detailed error reporting
  const errors = [];
  if (!parentName) errors.push("Parent's name is required");
  if (!studentName) errors.push("Student's name is required");
  if (!phone) errors.push("Phone number is required");
  if (!email) {
    errors.push("Email address is required");
    console.log('❌ EMAIL IS EMPTY!');
  }
  if (!grade) errors.push("Grade selection is required");
  if (!appointmentDate) errors.push("Appointment date is required");
  if (!preferredTime) errors.push("Preferred time is required");

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email && !emailRegex.test(email)) {
    errors.push("Please enter a valid email address");
    console.log('❌ EMAIL FORMAT IS INVALID:', email);
  }

  if (errors.length > 0) {
    console.log('❌ Validation errors:', errors);
    alert('Please fix the following errors:\n\n' + errors.join('\n'));
    return;
  }

  console.log('✅ Validation passed');

  // Show loading state
  const submitBtn = document.getElementById('confirm');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Sending...';
  submitBtn.disabled = true;

  // The correct server URL
  const SERVER_URL = 'http://localhost:5001/send-appointment-emails';
  console.log('🔗 Connecting to:', SERVER_URL);

  try {
    console.log('📤 Sending request to email server...');
    
    // Test server connection first
    console.log('🔍 Testing server connection...');
    const healthCheck = await fetch('http://localhost:5001/', {
      method: 'GET',
    });
    
    if (!healthCheck.ok) {
      throw new Error('Email server is not responding. Make sure it\'s running on port 5001.');
    }
    
    console.log('✅ Server is reachable');

    // Prepare the data to send
    const requestData = {
      parentName,
      studentName,
      phone,
      email,
      grade,
      appointmentDate,
      preferredTime,
      notes
    };

    console.log('📦 Data being sent to server:', requestData);
    console.log('🚨 CRITICAL: Email in request data:', requestData.email);
    
    // Send appointment request
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });

    console.log('📡 Server response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Server returned error:', errorData);
      
      // Check if it's an email-specific error
      if (errorData.details) {
        console.log('📧 Email sending details:', errorData.details);
        
        // Check if admin email failed because of placeholder email
        if (errorData.details.admin && errorData.details.admin.includes('example.com')) {
          throw new Error('Admin email failed: Please update the school email address in your server code (change "your-school-email@example.com" to your actual email)');
        }
      }
      
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Server response:', result);

    if (result.success) {
      console.log('🎉 Emails sent successfully!');
      console.log('📧 Parent email ID:', result.parentEmailId);
      console.log('📧 Admin email ID:', result.adminEmailId);
      
      // Additional logging for debugging
      console.log('🔍 Email sending summary:');
      console.log('   Email address used:', email);
      console.log('   Parent email success:', !!result.parentEmailId);
      console.log('   Admin email success:', !!result.adminEmailId);
      
      alert(`✅ Thank you ${parentName}! 

Your appointment request has been submitted successfully. 

📧 You'll receive a confirmation email shortly
📞 We'll contact you within 24 hours to confirm the details

Looking forward to meeting you and ${studentName}!

🔍 DEBUG INFO:
Email used: ${email}
Parent email ID: ${result.parentEmailId || 'Not provided'}
Admin email ID: ${result.adminEmailId || 'Not provided'}`);
      
      // Reset form
      form.reset();
    } else {
      throw new Error(result.error || 'Unknown error occurred');
    }

  } catch (err) {
    console.error('❌ Email sending error:', err);
    
    // Provide specific error messages
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      alert(`❌ Cannot connect to email server!

Make sure your email server is running:
1. Open terminal
2. Run: node email-server.js
3. Look for: "Email server running on http://localhost:5001"

Current error: ${err.message}`);
    } else if (err.message.includes('example.com')) {
      alert(`❌ Server configuration issue!

${err.message}

Please update your email-server.js file with your actual school email address.`);
    } else if (err.message.includes('Some emails failed')) {
      alert(`❌ Email sending partially failed.

This usually means:
- Your school email address needs to be updated in the server
- Or there's an issue with the Resend API key

Check the browser console for more details.

Error: ${err.message}`);
    } else {
      alert(`❌ There was an issue submitting your appointment request.

Error: ${err.message}

Please try again or contact us directly.`);
    }
  } finally {
    // Restore button state
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});