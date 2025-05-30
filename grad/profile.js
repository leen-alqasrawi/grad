import { getCurrentUserId, waitForUID, getUserData, makeAuthenticatedRequest } from "./firebase.js";

// Wait for authentication then load profile
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Wait for user to be authenticated
    const uid = await waitForUID();
    
    if (!uid) {
      window.location.href = "register.html";
      return;
    }
    
    await loadProfileData(uid);
    
  } catch (error) {
    console.error('Error initializing profile:', error);
    window.location.href = "register.html";
  }
});

async function loadProfileData(uid) {
  console.log('Loading profile data for user:', uid);
  
  try {
    // Get user data from Firestore
    const userData = await getUserData();
    
    if (userData) {
      document.getElementById("username").textContent = userData.username || "User";
      document.getElementById("email").textContent = userData.email || "No email";
      
      // Update profile picture if available
      if (userData.profilePicture) {
        const profileImg = document.querySelector('.profile-img');
        if (profileImg) {
          profileImg.src = userData.profilePicture;
        }
      }
    }
    
    // Load school preferences and statistics
    await Promise.all([
      loadSchoolPreferences(uid),
      loadUserStatistics()
    ]);
    
  } catch (error) {
    console.error('Error loading profile data:', error);
    showError("Failed to load profile data. Please refresh the page.");
  }
}

async function loadSchoolPreferences(uid) {
  try {
    const response = await fetch(`http://localhost:5000/api/users/form/${uid}`);
    const data = await response.json();
    
    const schoolDataContainer = document.getElementById("schoolData");
    
    if (!data || data.message) {
      schoolDataContainer.innerHTML = `
        <div class="data-item">
          <div class="data-label">Status</div>
          <div class="data-value">No preferences saved</div>
        </div>
        <div class="data-item">
          <div class="data-label">Action</div>
          <div class="data-value">
            <button onclick="window.location.href='findschool.html'" class="btn btn-primary">
              Set Preferences
            </button>
          </div>
        </div>
      `;
    } else {
      schoolDataContainer.innerHTML = `
        <div class="data-item">
          <div class="data-label">Location</div>
          <div class="data-value">${data.location || 'Not set'}</div>
        </div>
        <div class="data-item">
          <div class="data-label">Language</div>
          <div class="data-value">${data.language || 'Not set'}</div>
        </div>
        <div class="data-item">
          <div class="data-label">Special Needs</div>
          <div class="data-value">${data.special_needs || 'Not set'}</div>
        </div>
        <div class="data-item">
          <div class="data-label">Grade</div>
          <div class="data-value">${data.grade || 'Not set'}</div>
        </div>
        <div class="data-item">
          <div class="data-label">Mixed Schools</div>
          <div class="data-value">${data.mixed || 'Not set'}</div>
        </div>
      `;
    }
    
  } catch (error) {
    console.error('Error loading school preferences:', error);
    document.getElementById("schoolData").innerHTML = `
      <div class="data-item">
        <div class="data-label">Error</div>
        <div class="data-value">Failed to load preferences</div>
      </div>
    `;
  }
}

async function loadUserStatistics() {
  try {
    // Load viewed schools count
    const viewedSchoolsRaw = localStorage.getItem("viewedSchools");
    let viewedCount = 0;
    
    if (viewedSchoolsRaw) {
      try {
        const viewedSchools = JSON.parse(viewedSchoolsRaw);
        viewedCount = Array.isArray(viewedSchools) ? viewedSchools.length : 0;
      } catch (err) {
        console.error("Error parsing viewed schools:", err);
      }
    }
    
    // Update UI
    const viewedCountElement = document.getElementById("viewedCount");
    if (viewedCountElement) {
      viewedCountElement.textContent = viewedCount;
    }
    
  } catch (error) {
    console.error('Error loading statistics:', error);
  }
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed; top: 20px; right: 20px; background: #f44336; 
    color: white; padding: 15px; border-radius: 5px; z-index: 1000;
  `;
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  
  setTimeout(() => {
    if (document.body.contains(errorDiv)) {
      document.body.removeChild(errorDiv);
    }
  }, 5000);
}

// Profile functions
window.editInfo = function() {
  window.location.href = "findschool.html";
};

window.goToSchools = function() {
  const schoolResults = localStorage.getItem("schoolResults");
  if (!schoolResults || JSON.parse(schoolResults).length === 0) {
    alert("Search for schools first via 'Edit Information'.");
  } else {
    window.location.href = "schools.html";
  }
};

window.updateLocation = async function() {
  if (!navigator.geolocation) {
    alert("Geolocation not supported");
    return;
  }

  navigator.geolocation.getCurrentPosition(async (position) => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const uid = getCurrentUserId();

    if (!uid) {
      alert("Not authenticated");
      return;
    }

    try {
      const response = await makeAuthenticatedRequest('http://localhost:5000/api/users/update-location', {
        method: 'POST',
        body: JSON.stringify({ lat, lng })
      });

      if (response.ok) {
        alert("Location updated successfully!");
      } else {
        alert("Failed to update location.");
      }
    } catch (err) {
      console.error("Location update error:", err);
      alert("Error updating location.");
    }
  }, (err) => {
    console.error(err);
    alert("Could not get location.");
  });
};

window.logoutUser = function() {
  import("https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js")
    .then(({ signOut, getAuth }) => {
      const auth = getAuth();
      return signOut(auth);
    })
    .then(() => {
      localStorage.clear();
      console.log("User logged out successfully");
      window.location.href = "index.html";
    })
    .catch((error) => {
      console.error("Error signing out:", error);
      alert("Error logging out. Please try again.");
    });
};

console.log('Profile page initialized');