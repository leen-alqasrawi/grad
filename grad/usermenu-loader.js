// Import Firebase modules
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { firebaseConfig } from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Check if we're on the index page
const isIndex = window.location.pathname.includes('index.html') || window.location.pathname === "/";

if (!isIndex) {
  // Load Font Awesome for icons if not already loaded
  if (!document.querySelector('link[href*="font-awesome"]')) {
    const fontAwesome = document.createElement('link');
    fontAwesome.rel = 'stylesheet';
    fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    document.head.appendChild(fontAwesome);
  }

  // Create container if it doesn't exist
  if (!document.getElementById("userMenuContainer")) {
    const container = document.createElement("div");
    container.id = "userMenuContainer";
    document.body.appendChild(container);
  }

  // Load user menu HTML
  fetch("usermenu.html")
    .then(res => res.text())
    .then(html => {
      document.getElementById("userMenuContainer").innerHTML = html;

      // Bind dropdown toggle logic AFTER HTML is injected
      const btn = document.getElementById("userMenuBtn");
      const dropdown = document.getElementById("userDropdown");

      if (btn && dropdown) {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          dropdown.style.display = dropdown.style.display === "none" || !dropdown.style.display ? "block" : "none";
        });

        document.addEventListener("click", (e) => {
          if (dropdown.style.display === "block" && !dropdown.contains(e.target) && e.target !== btn) {
            dropdown.style.display = "none";
          }
        });

        dropdown.addEventListener("click", (e) => {
          e.stopPropagation();
        });
      }

      // Firebase auth listener
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          window.location.href = "register.html";
          return;
        }

        // Populate user data
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          document.getElementById("userMenuName").textContent = userData.username || "User";
          document.getElementById("userMenuEmail").textContent = user.email;

          // Use custom profile picture if available
          if (userData.profilePicture) {
            document.getElementById("userMenuAvatar").src = userData.profilePicture;
            document.getElementById("userDropdownAvatar").src = userData.profilePicture;
          }
        } else {
          // Fallback display
          document.getElementById("userMenuName").textContent = "User";
          document.getElementById("userMenuEmail").textContent = user.email;
        }
      });
    });
}

// Logout handler (must be global for inline HTML use)
window.logoutUser = function () {
  signOut(auth)
    .then(() => {
      localStorage.clear();
      window.location.href = "index.html";
    })
    .catch((error) => {
      console.error("Error signing out:", error);
    });
};
