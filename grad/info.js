document.addEventListener("DOMContentLoaded", async function () {
  console.log('Info page loaded, checking for school data');
  
  // Get school name from URL parameters
  const params = new URLSearchParams(window.location.search);
  const schoolNameParam = params.get("school");
  
  console.log('URL parameter school:', schoolNameParam);
  
  if (!schoolNameParam) {
    console.log('No school parameter in URL, checking localStorage');
    // Try to get from localStorage as fallback
    const schoolResults = localStorage.getItem('schoolResults');
    if (schoolResults) {
      const schools = JSON.parse(schoolResults);
      if (schools.length > 0) {
        console.log('Using first school from localStorage');
        displaySchoolInfo(schools[0]);
        
        // Setup modal after school info is loaded
        setupModalFunctionality();
        return;
      }
    }
    
    document.getElementById("schoolTitle").textContent = "No School Selected";
    populateSchoolInfo(null);
    
    // Setup modal even if no school
    setupModalFunctionality();
    return;
  }

  const schoolName = decodeURIComponent(schoolNameParam);
  console.log('Decoded school name:', schoolName);
  
  // Update title immediately
  document.getElementById("schoolTitle").textContent = schoolName;

  try {
    // Try to load from API first
    console.log('Attempting to load from API');
    const response = await fetch(`http://localhost:5000/api/schools/info?name=${encodeURIComponent(schoolName)}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('API data received:', data);
      displaySchoolInfo(data);
    } else {
      console.log('API request failed, falling back to localStorage');
      loadFromLocalStorage(schoolName);
    }
  } catch (error) {
    console.log('API error:', error.message);
    loadFromLocalStorage(schoolName);
  }

  // Setup modal functionality after everything is loaded
  setupModalFunctionality();
});

function loadFromLocalStorage(schoolName) {
  try {
    const schoolResults = localStorage.getItem('schoolResults');
    if (!schoolResults) {
      throw new Error('No school data in localStorage');
    }

    const schools = JSON.parse(schoolResults);
    console.log('Schools in localStorage:', schools.length);
    
    // Find the specific school
    const school = schools.find(school => 
      (school["اسم المدرسة"] === schoolName) || 
      (school["School Name"] === schoolName) ||
      (school["اسم المدرسة"]?.includes(schoolName)) ||
      (school["School Name"]?.includes(schoolName))
    );

    if (school) {
      console.log('Found school in localStorage:', school);
      displaySchoolInfo(school);
    } else {
      console.log('School not found in localStorage');
      // Display first school as fallback
      if (schools.length > 0) {
        console.log('Using first available school as fallback');
        displaySchoolInfo(schools[0]);
      } else {
        populateSchoolInfo(null);
      }
    }
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    populateSchoolInfo(null);
  }
}

function displaySchoolInfo(schoolData) {
  console.log('Displaying school info:', schoolData);
  
  if (!schoolData) {
    populateSchoolInfo(null);
    return;
  }

  // Update school title
  const schoolName = schoolData["اسم المدرسة"] || schoolData["School Name"] || "Unknown School";
  document.getElementById("schoolTitle").textContent = schoolName;

  // Populate the information tables
  populateSchoolInfo(schoolData);
  
  // Setup map button with school name
  setupMapButton(schoolName);
  
  // Load school image
  loadSchoolImage(schoolName);
  
  // Mark as viewed
  markSchoolAsViewed(schoolName);
}

function populateSchoolInfo(schoolData) {
  console.log('Populating school info');
  
  if (!schoolData) {
    // Set all fields to "Not Available"
    document.getElementById('system').textContent = 'Not Available';
    document.getElementById('special_needs').textContent = 'Not Available';
    document.getElementById('language').textContent = 'Not Available';
    document.getElementById('mixed').textContent = 'Not Available';
    document.getElementById('max_grade').textContent = 'Not Available';
    
    // Set all grade fees to "—"
    const gradeIds = ['kg1', 'kg2', 'prep', 'grade1', 'grade2', 'grade3', 'grade4', 'grade5', 'grade6', 'grade7', 'grade8', 'grade9', 'grade10', 'grade11', 'grade12'];
    gradeIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) element.textContent = '—';
    });
    return;
  }

  // basic information for the rest of the code
  const system = schoolData["نظام التدريسي"] || schoolData["نظام التعليمي"] || schoolData["School System"] || 'Not Available';
  const specialNeeds = extractDisabilityType(schoolData["تقبل الطلبة من ذوي الإحتياجات"] || schoolData["Special Needs"]);
  const language = schoolData["لغة التدريس"] || schoolData["Language of Instruction"] || 'Not Available';
  const mixed = normalizeMixedValue(schoolData["مختلطة"] || schoolData["Mixed"]);
  const maxGrade = schoolData["اعلى صف"] || schoolData["Highest Grade"] || 'Not Available';

  document.getElementById('system').textContent = system;
  document.getElementById('special_needs').textContent = specialNeeds;
  document.getElementById('language').textContent = language;
  document.getElementById('mixed').textContent = mixed;
  document.getElementById('max_grade').textContent = maxGrade;

  // grade fees(i updated it to match how the database looks like)
  const gradeMapping = {
    'kg1': ['الروضة | براعم', 'KG1'],
    'kg2': ['الروضة | بستان', 'KG2'], 
    'prep': ['الروضة | تمهيدي', 'Prep'],
    'grade1': ['الصف الاول', 'Grade 1'],
    'grade2': ['الصف الثاني', 'Grade 2'],
    'grade3': ['الصف الثالث', 'Grade 3'],
    'grade4': ['الصف الرابع', 'Grade 4'],
    'grade5': ['الصف الخامس', 'Grade 5'],
    'grade6': ['الصف السادس', 'Grade 6'],
    'grade7': ['الصف السابع', 'Grade 7'],
    'grade8': ['الصف الثامن', 'Grade 8'],
    'grade9': ['الصف التاسع', 'Grade 9'],
    'grade10': ['الصف العاشر', 'Grade 10'],
    'grade11': ['الصف الأول ثانوي', 'Grade 11'],
    'grade12': ['الصف الثاني ثانوي', 'Grade 12']
  };

  Object.entries(gradeMapping).forEach(([elementId, possibleKeys]) => {
    const element = document.getElementById(elementId);
    if (element) {
      let value = null;
      
      // try each key/grade
      for (const key of possibleKeys) {
        if (schoolData[key] !== undefined && schoolData[key] !== null) {
          value = schoolData[key];
          break;
        }
      }
      
      if (value !== null && value !== undefined && value !== '' && !isNaN(value) && Number(value) > 0) {
        element.textContent = `${value} JD`;
      } else {
        element.textContent = '—'; 
      }
    }
  });

  console.log('School info populated successfully');
}

function extractDisabilityType(text) {
  if (!text || text.trim().startsWith('لا') || text.toLowerCase().includes('no')) {
    return 'No';
  }
  const keywords = ['التوحد', 'صعوبات تعلم', 'إعاقة حركية', 'اعاقة حركية', 'autism', 'learning difficulties', 'physical disability'];
  const matched = keywords.filter(k => text.toLowerCase().includes(k.toLowerCase()));
  return matched.length > 0 ? `Yes (${matched.join(', ')})` : 'Yes';
}

function normalizeMixedValue(text) {
  if (!text) return 'Unknown';
  const lowerText = text.toLowerCase();
  if (lowerText.includes('غير') || lowerText.includes('ذكور') || lowerText.includes('إناث') || 
      lowerText.includes('boys') || lowerText.includes('girls') || lowerText.includes('single')) {
    return 'Not Mixed';
  }
  if (lowerText.includes('مختلطة') || lowerText.includes('mixed')) return 'Mixed';
  return 'Unknown';
}

function setupMapButton(schoolName) {
  const mapButton = document.getElementById("openMapButton");
  if (mapButton && schoolName) {
    mapButton.addEventListener("click", () => {
      const query = encodeURIComponent(`مدرسة ${schoolName}`);
      const googleMapsURL = `https://www.google.com/maps/search/?api=1&query=${query}`;
      window.open(googleMapsURL, "_blank");
    });
  }
}

function loadSchoolImage(schoolName) {
  // set the default image first
  const schoolImage = document.getElementById('schoolImage');
  if (schoolImage) {
    schoolImage.src = './images/default-school.jpg';
    schoolImage.alt = schoolName || 'School Photo';
    
    schoolImage.addEventListener('click', () => {
      const query = encodeURIComponent(`مدرسة ${schoolName}`);
      const googleMapsURL = `https://www.google.com/maps/search/?api=1&query=${query}`;
      window.open(googleMapsURL, "_blank");
    });
  }
  
  // try to load Google maps photo if its available
  if (window.google && window.google.maps && window.google.maps.places && schoolName) {
    console.log('Attempting to load school image from Google Maps');
    loadGoogleMapsPhoto(schoolName);
  }
}

function loadGoogleMapsPhoto(schoolName) {
  const service = new google.maps.places.PlacesService(document.createElement('div'));
  const query = `مدرسة ${schoolName}`;
  
  service.textSearch({ query }, (results, status) => {
    if (status === google.maps.places.PlacesServiceStatus.OK && results[0]) {
      const place = results[0];
      
      service.getDetails({ placeId: place.place_id, fields: ['photos'] }, (placeDetails, detailStatus) => {
        if (detailStatus === google.maps.places.PlacesServiceStatus.OK && placeDetails.photos?.length) {
          const photoUrl = placeDetails.photos[0].getUrl({ maxWidth: 400, maxHeight: 300 });
          const schoolImage = document.getElementById('schoolImage');
          if (schoolImage) {
            schoolImage.src = photoUrl;
            console.log('School image loaded from Google Maps');
          }
        }
      });
    }
  });
}
//mark as viewed for profile.html
function markSchoolAsViewed(schoolName) {
  try {
    const viewed = JSON.parse(localStorage.getItem("viewedSchools") || "[]");
    if (!viewed.includes(schoolName)) {
      viewed.push(schoolName);
      localStorage.setItem("viewedSchools", JSON.stringify(viewed));
      console.log('School marked as viewed');
    }
  } catch (error) {
    console.error('Error marking school as viewed:', error);
  }
}

// modal functionality(dialog box for when we want to link a student to teh school specified)
function setupModalFunctionality() {
  console.log('Setting up dialogbox...');
  
  const selectBtn = document.getElementById('selectSchoolBtn');
  const modal = document.getElementById('schoolModal');
  const closeBtn = document.getElementById('closeModal');
  const cancelBtn = document.getElementById('cancelBtn');
  const form = document.getElementById('schoolSelectionForm');
  
  console.log('Modal elements found:', {
    selectBtn: !!selectBtn,
    modal: !!modal,
    closeBtn: !!closeBtn,
    cancelBtn: !!cancelBtn,
    form: !!form
  });
  
  // Open modal
  if (selectBtn) {
    selectBtn.addEventListener('click', function() {
      console.log('Select school button clicked!');
      openModal();
    });
  }
  
  // Close modal functions
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeModal);
  }
  
  // Close modal when clicking outside
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        closeModal();
      }
    });
  }
  
  // Form submission
  if (form) {
    form.addEventListener('submit', handleFormSubmission);
  }
  
  console.log('Modal functionality setup complete!');
}

function openModal() {
  console.log('Opening modal...');
  const modal = document.getElementById('schoolModal');
  if (modal) {
    modal.classList.add('show');
    autofillForm();
  }
}

function closeModal() {
  console.log('Closing modal...');
  const modal = document.getElementById('schoolModal');
  if (modal) {
    modal.classList.remove('show');
    const form = document.getElementById('schoolSelectionForm');
    if (form) {
      form.reset();
    }
  }
}

function autofillForm() {
  console.log('Starting autofill...');
  
  // Pre-fill school name
  const schoolName = document.getElementById('schoolTitle').textContent;
  const selectedSchoolInput = document.getElementById('selectedSchool');
  if (selectedSchoolInput) {
    selectedSchoolInput.value = schoolName;
    console.log('School name filled:', schoolName);
  }
  
  // Try to auto-fill email from localStorage
  const storedEmail = localStorage.getItem('userEmail');
  if (storedEmail) {
    const emailInput = document.getElementById('parentEmail');
    if (emailInput) {
      emailInput.value = storedEmail;
      console.log('Email filled from localStorage:', storedEmail);
    }
  }
  
  // Try to auto-fill grade from localStorage
  const lastFilters = localStorage.getItem('lastSearchFilters');
  if (lastFilters) {
    try {
      const filters = JSON.parse(lastFilters);
      if (filters.grade) {
        const gradeSelect = document.getElementById('studentGrade');
        if (gradeSelect) {
          gradeSelect.value = filters.grade;
          console.log('Grade filled from filters:', filters.grade);
        }
      }
    } catch (e) {
      console.log('Could not parse filters');
    }
  }
}

function showMessage(message, type) {
  const messageDiv = document.getElementById('modalMessage');
  if (messageDiv) {
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 5000);
  }
}

async function handleFormSubmission(e) {
  e.preventDefault();
  console.log('Form submitted!');
  
  const submitBtn = document.getElementById('submitBtn');
  const originalText = submitBtn.textContent;
  
  // get form data
  const formData = {
    parentName: document.getElementById('parentName').value.trim(),
    parentEmail: document.getElementById('parentEmail').value.trim(),
    studentName: document.getElementById('studentName').value.trim(),
    studentGrade: document.getElementById('studentGrade').value,
    homeAddress: document.getElementById('homeAddress').value.trim(),
    schoolName: document.getElementById('selectedSchool').value
  };
  
  console.log('Form data:', formData);
  
  // Validation
  if (!formData.parentName || !formData.parentEmail || !formData.studentName || !formData.studentGrade) {
    showMessage('Please fill in all required fields', 'error');
    return;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(formData.parentEmail)) {
    showMessage('Please enter a valid email address', 'error');
    return;
  }
  
  // Show loading
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="loading-spinner"></span>Processing...';
  
  try {
    console.log('Submitting to API...');
    const response = await fetch('http://localhost:5000/api/school-selection/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    });
    
    const result = await response.json();
    console.log('API response:', result);
    
    if (response.ok && result.success) {
      showMessage(`🎉 Success! Student ID: ${result.studentId} has been sent to your email.`, 'success');
      
      // Save for future autofill
      localStorage.setItem('userEmail', formData.parentEmail);
      localStorage.setItem('lastSearchFilters', JSON.stringify({
        grade: formData.studentGrade,
        school: formData.schoolName
      }));
      
      // Close modal after 3 seconds
      setTimeout(() => {
        closeModal();
      }, 3000);
      
    } else {
      showMessage(result.error || 'Failed to submit school selection', 'error');
    }
    
  } catch (error) {
    console.error('Error submitting:', error);
    showMessage('Network error. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}