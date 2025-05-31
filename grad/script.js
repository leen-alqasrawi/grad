// Wait until the entire page is fully loaded before running script
document.addEventListener("DOMContentLoaded", () => {
  // Initialize testimonial slides
  initializeTestimonials();
  
  // Initialize review functionality
  initializeReviews();
  
  // Initialize contact form
  initializeContactForm();
});

function initializeTestimonials() {
  // Grab elements from the page
  const testimonialSection = document.getElementById('testimonials');  // The whole testimonial area
  const titleElement = document.getElementById('feature-title');       // The title (e.g., "Smart Matching")
  const listElement = document.getElementById('feature-list');         // The <ul> where feature <li> items go
  const dots = document.querySelectorAll('.dot');                      // All navigation dots

  // Define the slides (title, background image, and features for each)
  const slides = [
    {
      title: "Smart Matching",
      image: "../images/smartmatching.jpg",
      features: [
        "Find schools that match your criteria",
        "Tailored recommendations",
        "Covers all regions",
        "Updated school data"
      ]
    },
    {
      title: "Track The Bus",
      image: "../images/trackthebus.jpg",
      features: [
        "Live GPS tracking",
        "Notifications on bus arrival",
        "Safety alerts",
        "Parent access dashboard"
      ]
    },
    {
      title: "Book Appointments",
      image: "../images/pic3.jpeg",
      features: [
        "Easy and quick booking process",
        "Direct communication with schools",
        "Custom time selection",
        "Confirmation within 24 hours"
      ]
    }
  ];

  // Function to show a specific slide by index
  function showSlide(index) {
    const slide = slides[index];

    // Change the background image of the testimonial section
    testimonialSection.style.backgroundImage = `url('${slide.image}')`;

    // Update the title
    titleElement.textContent = slide.title;

    // Create a list item <li> for each feature and insert into the feature list
    listElement.innerHTML = slide.features.map(f => `<li> ${f}</li>`).join('');

    // Update the dots: highlight the one for the current slide
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
  }

  // Add click functionality to each dot to switch slides
  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => showSlide(index));
  });

  // Show the first slide when the page loads
  showSlide(0);
  let currentIndex = 0;
  setInterval(() => {
    currentIndex = (currentIndex + 1) % slides.length;
    showSlide(currentIndex);
  }, 3000); // Auto-rotate every 3 seconds
}

// ================== REVIEW FUNCTIONALITY ==================

function initializeReviews() {
  const reviewForm = document.getElementById('reviewForm');
  
  if (reviewForm) {
    reviewForm.addEventListener('submit', handleReviewSubmit);
    loadRecentReviews();
  }
}

async function handleReviewSubmit(event) {
  event.preventDefault();
  
  const submitButton = event.target.querySelector('button[type="submit"]');
  const originalButtonText = submitButton.textContent;
  
  // Get form data
  const formData = {
    reviewerName: document.getElementById('reviewerName').value.trim(),
    reviewMessage: document.getElementById('reviewMessage').value.trim(),
    rating: getSelectedRating()
  };

  // Get Firebase UID if user is logged in
  try {
    const loggedInUserId = localStorage.getItem('loggedInUserId');
    if (loggedInUserId) {
      formData.firebaseUid = loggedInUserId;
    }
  } catch (error) {
    console.log('No user logged in');
  }

  // Validation
  if (!formData.reviewerName || formData.reviewerName.length < 2) {
    alert('Please enter your full name (minimum 2 characters)');
    return;
  }

  if (!formData.reviewMessage || formData.reviewMessage.length < 10) {
    alert('Please write a review message (minimum 10 characters)');
    return;
  }

  // Disable submit button
  submitButton.disabled = true;
  submitButton.textContent = 'Submitting...';

  try {
    console.log('📝 Submitting review:', formData);
    
    const response = await fetch('http://localhost:5000/api/reviews/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    });

    const result = await response.json();
    console.log('📝 Server response:', result);

    if (response.ok && result.success) {
      alert('Thank you for your review! 🎉');
      
      // Reset form
      event.target.reset();
      resetStarRating();
      
      // Reload reviews
      setTimeout(() => {
        loadRecentReviews();
      }, 1000);

    } else {
      alert(result.error || 'Failed to submit review. Please try again.');
    }

  } catch (error) {
    console.error('❌ Error submitting review:', error);
    alert('Network error. Please check your connection and try again.');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
  }
}

function getSelectedRating() {
  const selectedRating = document.querySelector('input[name="rating"]:checked');
  return selectedRating ? parseInt(selectedRating.value) : null;
}

function resetStarRating() {
  const ratingInputs = document.querySelectorAll('input[name="rating"]');
  ratingInputs.forEach(input => input.checked = false);
}

async function loadRecentReviews() {
  console.log('🔄 Starting to load recent reviews...');
  
  try {
    const url = 'http://localhost:5000/api/reviews?limit=10';
    console.log('📡 Fetching from:', url);
    
    const response = await fetch(url);
    console.log('📡 Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('📖 Raw server response:', data);
    console.log('📖 Reviews array:', data.reviews);
    console.log('📖 Number of reviews:', data.reviews ? data.reviews.length : 0);

    if (data.reviews && Array.isArray(data.reviews)) {
      if (data.reviews.length > 0) {
        console.log('✅ Found reviews, calling displayRecentReviews...');
        displayRecentReviews(data.reviews);
      } else {
        console.log('ℹ️ No reviews found, showing empty message...');
        showNoReviewsMessage();
      }
    } else {
      console.error('❌ Invalid response format - reviews is not an array:', typeof data.reviews);
      showNoReviewsMessage();
    }
    
  } catch (error) {
    console.error('❌ Error loading recent reviews:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack
    });
    showErrorMessage();
  }
}

function displayRecentReviews(reviews) {
  console.log('🎨 Starting to display reviews:', reviews);
  
  const container = document.getElementById('recentReviews');
  
  if (!container) {
    console.error('❌ Container element #recentReviews not found!');
    console.log('Available elements with "review" in ID:');
    document.querySelectorAll('[id*="review"]').forEach(el => {
      console.log('  -', el.id, el.tagName);
    });
    return;
  }
  
  console.log('✅ Container found:', container);

  if (!Array.isArray(reviews) || reviews.length === 0) {
    console.warn('⚠️ No reviews to display');
    showNoReviewsMessage();
    return;
  }

  try {
    const reviewsHTML = reviews.map((review, index) => {
      console.log(`📝 Processing review ${index + 1}:`, review);
      
      const date = new Date(review.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      const stars = review.rating ? '⭐'.repeat(review.rating) : '';
      
      return `
        <div style="background: #f8f9fa; padding: 20px; margin: 15px 0; border-radius: 12px; border-left: 4px solid #19497b; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <strong style="color: #19497b; font-size: 16px;">${escapeHtml(review.reviewer_name)}</strong>
            <span style="font-size: 12px; color: #666; background: #e9ecef; padding: 4px 8px; border-radius: 4px;">${date}</span>
          </div>
          ${review.rating ? `<div style="margin-bottom: 10px; font-size: 16px;">${stars}</div>` : ''}
          <div style="color: #444; line-height: 1.6; font-size: 14px;">${escapeHtml(review.review_message)}</div>
        </div>
      `;
    }).join('');

    const finalHTML = `
      <div style="margin-top: 40px; padding: 30px; background: white; border-radius: 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e9ecef;">
        <h3 style="color: #19497b; margin-bottom: 25px; text-align: center; font-size: 24px; position: relative;">
          Recent Reviews
          <div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); width: 50px; height: 3px; background: #19497b; border-radius: 2px;"></div>
        </h3>
        <div style="max-height: 400px; overflow-y: auto;">
          ${reviewsHTML}
        </div>
      </div>
    `;

    console.log('🎨 Setting innerHTML for container...');
    container.innerHTML = finalHTML;
    console.log('✅ Reviews displayed successfully!');
    
  } catch (error) {
    console.error('❌ Error in displayRecentReviews:', error);
    showErrorMessage();
  }
}

function showNoReviewsMessage() {
  const container = document.getElementById('recentReviews');
  if (container) {
    container.innerHTML = `
      <div style="margin-top: 30px; text-align: center; color: #666; padding: 20px;">
        <h3 style="color: #19497b; margin-bottom: 15px;">Recent Reviews</h3>
        <p>No reviews yet. Be the first to leave a review! 🌟</p>
      </div>
    `;
    console.log('ℹ️ No reviews message displayed');
  }
}

function showErrorMessage() {
  const container = document.getElementById('recentReviews');
  if (container) {
    container.innerHTML = `
      <div style="margin-top: 30px; text-align: center; color: #666; padding: 20px;">
        <h3 style="color: #19497b; margin-bottom: 15px;">Recent Reviews</h3>
        <p>Unable to load reviews at the moment. Please try again later.</p>
      </div>
    `;
    console.log('❌ Error message displayed');
  }
}

// ================== CONTACT FORM FUNCTIONALITY ==================

function initializeContactForm() {
  const contactForm = document.querySelector('.contact-form');
  
  if (contactForm) {
    contactForm.addEventListener('submit', handleContactSubmit);
    
    // Add CSS styles for contact form messages
    addContactFormStyles();
  }
}

async function handleContactSubmit(event) {
  event.preventDefault();
  
  const submitButton = event.target.querySelector('button[type="submit"]');
  const originalButtonText = submitButton.textContent;
  
  // Get form data
  const formData = {
    fullName: event.target.querySelector('input[placeholder="Full Name"]').value.trim(),
    phoneNumber: event.target.querySelector('input[placeholder="Phone Number"]').value.trim(),
    emailAddress: event.target.querySelector('input[placeholder="Email Address"]').value.trim(),
    message: event.target.querySelector('textarea[placeholder="Message"]').value.trim()
  };

  // Basic validation
  if (!formData.fullName || formData.fullName.length < 2) {
    showContactMessage('Please enter your full name (minimum 2 characters)', 'error');
    return;
  }

  if (!formData.phoneNumber || formData.phoneNumber.length < 10) {
    showContactMessage('Please enter a valid phone number', 'error');
    return;
  }

  if (!formData.emailAddress || !isValidEmail(formData.emailAddress)) {
    showContactMessage('Please enter a valid email address', 'error');
    return;
  }

  if (!formData.message || formData.message.length < 10) {
    showContactMessage('Please enter a message (minimum 10 characters)', 'error');
    return;
  }

  // Disable submit button and show loading
  submitButton.disabled = true;
  submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

  try {
    console.log('Submitting contact form:', formData);
    
    const response = await fetch('http://localhost:5000/api/contact/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    });

    const result = await response.json();
    console.log('Contact form response:', result);

    if (response.ok && result.success) {
      showContactMessage(result.message || 'Thank you for your message! We will get back to you within 24 hours.', 'success');
      
      // Reset form
      event.target.reset();
      
    } else {
      showContactMessage(result.error || 'Failed to send message. Please try again.', 'error');
    }

  } catch (error) {
    console.error('Error submitting contact form:', error);
    showContactMessage('Network error. Please check your connection and try again.', 'error');
  } finally {
    // Reset button
    submitButton.disabled = false;
    submitButton.innerHTML = originalButtonText;
  }
}

function showContactMessage(message, type) {
  // Remove any existing message
  const existingMessage = document.querySelector('.contact-message');
  if (existingMessage) {
    existingMessage.remove();
  }

  // Create new message element
  const messageDiv = document.createElement('div');
  messageDiv.className = `contact-message ${type}`;
  messageDiv.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i>
    ${message}
  `;

  // Insert before the contact form
  const contactForm = document.querySelector('.contact-form');
  const contactRight = document.querySelector('.contact-right');
  
  if (contactForm && contactRight) {
    contactRight.insertBefore(messageDiv, contactForm);
  }

  // Auto-hide after 8 seconds
  setTimeout(() => {
    if (messageDiv && messageDiv.parentNode) {
      messageDiv.remove();
    }
  }, 8000);
}

function addContactFormStyles() {
  // Check if styles already added
  if (document.getElementById('contact-form-styles')) {
    return;
  }

  const contactMessageCSS = `
    .contact-message {
      margin-bottom: 20px;
      padding: 15px 20px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 500;
      animation: slideDown 0.3s ease-out;
    }

    .contact-message.success {
      background-color: rgba(34, 197, 94, 0.1);
      border: 1px solid #22c55e;
      color: #15803d;
    }

    .contact-message.error {
      background-color: rgba(239, 68, 68, 0.1);
      border: 1px solid #ef4444;
      color: #dc2626;
    }

    .contact-message i {
      font-size: 18px;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .contact-form button:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .contact-form button i.fa-spinner {
      margin-right: 8px;
    }
  `;

  // Add the CSS to the page
  const contactStyleElement = document.createElement('style');
  contactStyleElement.id = 'contact-form-styles';
  contactStyleElement.textContent = contactMessageCSS;
  document.head.appendChild(contactStyleElement);
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Debug functions
window.testLoadReviews = function() {
  console.log('🧪 Manual test: Loading reviews...');
  loadRecentReviews();
};

window.checkReviewContainer = function() {
  const container = document.getElementById('recentReviews');
  console.log('Container check:', {
    exists: !!container,
    element: container,
    innerHTML: container ? container.innerHTML : 'N/A'
  });
};