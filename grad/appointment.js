document.getElementById('submitButton').addEventListener('click', async function (e) {
  e.preventDefault();

  // get form elements by order (more reliable)
  const form = document.querySelector('form');
  const inputs = form.querySelectorAll('input');
  const select = form.querySelector('select');
  const textarea = form.querySelector('textarea');

  // extract data by input order in your HTML
  const parentName = inputs[0].value.trim();     // first input
  const studentName = inputs[1].value.trim();   // second input
  const phone = inputs[2].value.trim();         // third input
  const email = inputs[3].value.trim();         // fourth input
  const grade = select.value;                   // select element
  const appointmentDate = inputs[4].value;      // fifth input (date)
  const preferredTime = inputs[5].value;        // sixth input (time)
  const notes = textarea.value.trim();          // textarea

  // check if all required fields are filled
  if (!parentName || !studentName || !phone || !email || !grade || !appointmentDate || !preferredTime) {
    alert('Please fill in all required fields');
    return;
  }

  // check email format
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    alert('Please enter a valid email address');
    return;
  }

  // disable button while sending
  const submitBtn = document.getElementById('submitButton');
  submitBtn.textContent = 'Sending...';
  submitBtn.disabled = true;

  try {
    // send the appointment data
    const response = await fetch('http://localhost:5000/api/email/send-appointment-emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parentName: parentName,
        studentName: studentName,
        phone: phone,
        email: email,
        grade: grade,
        appointmentDate: appointmentDate,
        preferredTime: preferredTime,
        notes: notes
      })
    });

    const result = await response.json();

    if (response.ok && result.success) {
      alert('Thank you! Your appointment request has been submitted. You will receive a confirmation email shortly.');
      // clear the form
      form.reset();
    } else {
      alert('Error: ' + (result.error || 'Something went wrong'));
    }

  } catch (error) {
    console.error('Error submitting appointment:', error);
    alert('Could not submit appointment. Please check if the email server is running and try again.');
  } finally {
    // restore button
    submitBtn.textContent = 'Submit Request';
    submitBtn.disabled = false;
  }
});