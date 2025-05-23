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

    // 🖼️ Show school image via Google Places
    await loadGoogleMapsIfNeeded();
    showSchoolImage(data["اسم المدرسة"]);

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

function showSchoolImage(schoolName) {
  const query = `مدرسة ${schoolName}`;
  const service = new google.maps.places.PlacesService(document.createElement('div'));
  
  service.textSearch({ query }, (results, status) => {
    if (status !== google.maps.places.PlacesServiceStatus.OK || !results[0]) {
      console.warn("School not found on Google Maps.");
      return;
    }

    const place = results[0];

    service.getDetails({ placeId: place.place_id, fields: ['photos'] }, (placeDetails, detailStatus) => {
      if (detailStatus === google.maps.places.PlacesServiceStatus.OK && placeDetails.photos?.length) {
        const photoUrl = placeDetails.photos[0].getUrl();
        const img = document.createElement('img');
        img.src = photoUrl;
        img.alt = schoolName;
        img.style = "width: 100%; max-width: 400px; margin-top: 10px;";
        document.getElementById('school-photo').innerHTML = '';
        document.getElementById('school-photo').appendChild(img);
      }
    });
  });
}
