import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const uid = user.uid;
    document.getElementById("email").textContent = user.email;

    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      document.getElementById("username").textContent = userDoc.data().username;
    }

    fetch(`http://localhost:5000/get-user-form/${uid}`)
      .then(res => res.json())
      .then(data => {
        if (!data || data.message) {
          document.getElementById("schoolData").innerHTML = `
            <div class="data-item">
              <div class="data-label">Status</div>
              <div class="data-value">No data submitted</div>
            </div>
          `;
        } else {
          document.getElementById("schoolData").innerHTML = `
            <div class="data-item">
              <div class="data-label">Location</div>
              <div class="data-value">${data.location}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Language</div>
              <div class="data-value">${data.language}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Special Needs</div>
              <div class="data-value">${data.special_needs}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Grade selected</div>
              <div class="data-value">${data.grade}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Mixed</div>
              <div class="data-value">${data.mixed}</div>
            </div>
          `;
        }
      });

    // Set number of viewed schools from localStorage
    const viewedSchoolsRaw = localStorage.getItem("viewedSchools");
    if(viewedSchoolsRaw){
      try{
        const viewedSchools = JSON.parse(viewedSchoolsRaw);
        document.getElementById("viewedCount").textContent = viewedSchools.length;
      } catch(err){
        console.error("error parsing viewedScools", err);
      }
    }
  } else {
    window.location.href = "register.html";
  }
});


window.editInfo = function () {
  window.location.href = "findschool.html";
};

// Optional: Logout functionality hook
window.logout = function () {
  signOut(auth)
    .then(() => {
      window.location.href = "index.html";
    })
    .catch((error) => {
      console.error("Logout failed:", error);
    });
};
window.goToSchools = function () {
  const schoolResults = localStorage.getItem("schoolResults");
  if (!schoolResults || JSON.parse(schoolResults).length === 0) {
    alert("You need to search for schools first via 'Edit Information'.");
  } else {
    window.location.href = "schools.html";
  }
};
window.updateLocation = function () {
  if (!navigator.geolocation) {
    alert("Geolocation not supported");
    return;
  }

  navigator.geolocation.getCurrentPosition(async (position) => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    const user = auth.currentUser;
    if (!user) return alert("User not authenticated");

    const uid = user.uid;

    try {
      const res = await fetch('http://localhost:5000/update-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, lat, lng })
      });

      const data = await res.json();
      if (res.ok) {
        alert("✅ Location updated successfully!");
        console.log("UID being sent:", uid);
      } else {
        console.error(data);
        alert("❌ Failed to update location.");
      }
    } catch (err) {
      console.error("Error sending location:", err);
      alert("❌ Server error while updating location.");
    }
  }, (err) => {
    console.error(err);
    alert("❌ Permission denied or error getting location.");
  });
};

window.logoutUser = window.logout;


