// Wait until the entire page is fully loaded before running script
document.addEventListener("DOMContentLoaded", () => {
  
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
});

//////////////////////////////// CODE FOR REVIEW ///////////////////
document.addEventListener("DOMContentLoaded", () => {
  const reviewForm = document.getElementById("reviewForm");

  if (reviewForm) {
    reviewForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const name = document.getElementById("reviewerName").value.trim();
      const message = document.getElementById("reviewMessage").value.trim();
      const ratingInput = document.querySelector('input[name="rating"]:checked');
      const rating = ratingInput ? ratingInput.value : null;

      if (name && message) {
        // Show success message instead of alert
        const successMsg = document.getElementById("reviewSuccessMsg");
        successMsg.style.display = "block";

        setTimeout(() => {
          successMsg.style.display = "none";
        }, 4000);

        reviewForm.reset();
        const stars = document.querySelectorAll('input[name="rating"]');
        stars.forEach(star => star.checked = false);
      }
    });
  }
});
///////////////////////////////////////////////////////
