document.addEventListener("DOMContentLoaded", async function () {
  const params = new URLSearchParams(window.location.search);
  const schoolName = params.get("school");
  if (!schoolName) return;

  try {
    const response = await fetch(`http://localhost:5000/school-info?name=${encodeURIComponent(schoolName)}`);
    if (!response.ok) throw new Error('Failed to load school data');

    const data = await response.json();

    // 🏷️ Update school title
    const titleElement = document.getElementById("schoolTitle");
    if (titleElement) {
      titleElement.textContent = data["اسم المدرسة"] || "معلومات المدرسة";
    }

    // 🧾 Fill general info table
    document.getElementById("system").textContent = data["نظام التعليمي"] || '—';
    document.getElementById("special_needs").textContent = data["تقبل الطلبة من ذوي الإحتياجات"] || '—';
    document.getElementById("language").textContent = data["لغة التدريس"] || '—';
    document.getElementById("mixed").textContent = data["مختلطة"] || '—';
    document.getElementById("max_grade").textContent = data["اعلى صف"] || '—';

    // 🧮 Tuition per grade
    const gradeFields = {
      "براعم": "الروضة | براعم",
      "بستان": "الروضة | بستان",
      "تمهيدي": "الروضة | تمهيدي",
      "الاول": "الصف الاول",
      "الثاني": "الصف الثاني",
      "الثالث": "الصف الثالث",
      "الرابع": "الصف الرابع",
      "الخامس": "الصف الخامس",
      "السادس": "الصف السادس",
      "السابع": "الصف السابع",
      "الثامن": "الصف الثامن",
      "التاسع": "الصف التاسع",
      "العاشر": "الصف العاشر",
      "الاول ثانوي": "الصف الأول ثانوي",
      "الثاني ثانوي": "الصف الثاني ثانوي"
    };

    Object.entries(gradeFields).forEach(([id, dbKey]) => {
      const cell = document.getElementById(id);
      if (cell) {
        const value = data[dbKey];
        cell.textContent = value !== null && value !== undefined ? `${value} د.أ` : '—';
      }
    });

    // 🖼️ Show school image via Google Places with Vision API validation
    await loadGoogleMapsIfNeeded();
    await showValidatedSchoolImage(data["اسم المدرسة"]);

    // 📍 Map redirect button
    const mapButton = document.getElementById("openMapButton");
    if (mapButton && data["اسم المدرسة"]) {
      const query = encodeURIComponent(`مدرسة ${data["اسم المدرسة"]}`);
      const googleMapsURL = `https://www.google.com/maps/search/?api=1&query=${query}`;
      mapButton.addEventListener("click", () => {
        window.open(googleMapsURL, "_blank");
      });
    }

    const viewed = JSON.parse(localStorage.getItem("viewedSchools") || "[]");
    if (!viewed.includes(data["اسم المدرسة"])) {
      viewed.push(data["اسم المدرسة"]);
      localStorage.setItem("viewedSchools", JSON.stringify(viewed));
    }

  } catch (error) {
    console.error("Error loading school info:", error);
    alert("فشل تحميل معلومات المدرسة. حاول مرة أخرى.");
  }
});

function loadGoogleMapsIfNeeded() {
  return new Promise(resolve => {
    if (window.google && window.google.maps && window.google.maps.places) {
      resolve();
    } else {
      window.initMap = resolve;
    }
  });
}

// 🔍 Enhanced function with Google Cloud Vision validation
async function showValidatedSchoolImage(schoolName) {
  const query = `مدرسة ${schoolName}`;
  const service = new google.maps.places.PlacesService(document.createElement('div'));
  
  // Show loading indicator
  showLoadingImage();
  
  service.textSearch({ query }, async (results, status) => {
    if (status !== google.maps.places.PlacesServiceStatus.OK || !results[0]) {
      console.warn("School not found on Google Maps.");
      showDefaultImage();
      return;
    }

    const place = results[0];

    service.getDetails({ placeId: place.place_id, fields: ['photos'] }, async (placeDetails, detailStatus) => {
      if (detailStatus === google.maps.places.PlacesServiceStatus.OK && placeDetails.photos?.length) {
        
        // Get multiple photos to increase chances of finding a valid building image
        const photosToCheck = placeDetails.photos.slice(0, 3); // Check up to 3 photos
        let validImageFound = false;

        for (let i = 0; i < photosToCheck.length && !validImageFound; i++) {
          const photoUrl = photosToCheck[i].getUrl({ maxWidth: 400, maxHeight: 300 });
          
          try {
            const isValidBuilding = await validateImageWithVision(photoUrl);
            
            if (isValidBuilding) {
              showValidatedImage(photoUrl, schoolName);
              validImageFound = true;
            }
          } catch (error) {
            console.error(`Error validating image ${i + 1}:`, error);
          }
        }

        // If no valid building image found, show default
        if (!validImageFound) {
          console.log("No valid building images found, using default image.");
          showDefaultImage();
        }
      } else {
        showDefaultImage();
      }
    });
  });
}

// 🤖 Validate image using Google Cloud Vision API
async function validateImageWithVision(imageUrl) {
  try {
    const response = await fetch('http://localhost:5000/validate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUrl })
    });

    if (!response.ok) {
      throw new Error(`Vision API request failed: ${response.status}`);
    }

    const result = await response.json();
    return result.isValidBuilding;
  } catch (error) {
    console.error('Error calling Vision API:', error);
    return false; // Default to false if validation fails
  }
}

// 🖼️ Display validated image
function showValidatedImage(imageUrl, schoolName) {
  const img = document.createElement('img');
  img.src = imageUrl;
  img.alt = schoolName;
  img.style = "width: 100%; max-width: 400px; margin-top: 10px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);";
  
  // Add a small indicator that this image was validated
  const container = document.createElement('div');
  container.style = "position: relative; display: inline-block;";
  
  const badge = document.createElement('div');
  badge.innerHTML = '✓';
  badge.style = "position: absolute; top: 5px; right: 5px; background: #28a745; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;";
  badge.title = "تم التحقق من صحة الصورة";
  
  container.appendChild(img);
  container.appendChild(badge);
  
  const photoDiv = document.getElementById('school-photo');
  photoDiv.innerHTML = '';
  photoDiv.appendChild(container);
}

// 🏢 Show default fallback image
function showDefaultImage() {
  const img = document.createElement('img');
  img.src = './images/school-info2.png';
  img.alt = 'صورة افتراضية للمدرسة';
  img.style = "width: 100%; max-width: 400px; margin-top: 10px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); opacity: 0.8;";
  
  const container = document.createElement('div');
  container.style = "position: relative; display: inline-block;";
  
  const badge = document.createElement('div');
  badge.innerHTML = '🏫';
  badge.style = "position: absolute; top: 5px; right: 5px; background: #6c757d; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px;";
  badge.title = "صورة افتراضية";
  
  container.appendChild(img);
  container.appendChild(badge);
  
  const photoDiv = document.getElementById('school-photo');
  photoDiv.innerHTML = '';
  photoDiv.appendChild(container);
}

// ⏳ Show loading state
function showLoadingImage() {
  const loadingDiv = document.createElement('div');
  loadingDiv.style = "width: 100%; max-width: 400px; height: 200px; margin-top: 10px; border-radius: 10px; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: loading 2s infinite; display: flex; align-items: center; justify-content: center; color: #666;";
  loadingDiv.innerHTML = 'جاري التحقق من الصورة...';
  
  // Add CSS animation for loading effect
  if (!document.getElementById('loading-style')) {
    const style = document.createElement('style');
    style.id = 'loading-style';
    style.textContent = `
      @keyframes loading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  const photoDiv = document.getElementById('school-photo');
  photoDiv.innerHTML = '';
  photoDiv.appendChild(loadingDiv);
}