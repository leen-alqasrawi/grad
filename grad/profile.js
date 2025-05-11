import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
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
              <div class="data-label">Grade Range</div>
              <div class="data-value">${data.grade_from} to ${data.grade_to}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Mixed</div>
              <div class="data-value">${data.mixed}</div>
            </div>
          `;
        }
      });
  } else {
    window.location.href = "register.html";
  }
});

window.editInfo = function() {
  window.location.href = "findschool.html";
};
