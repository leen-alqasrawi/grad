import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Helper function to display messages
function showMessage(msg, targetId) {
  const messageDiv = document.getElementById(targetId);
  messageDiv.style.display = "block";
  messageDiv.innerHTML = msg;
  setTimeout(function () {
    messageDiv.style.opacity = 0;
  }, 5000);
}

// Handle Signup Logic
if (window.location.pathname.includes("signup.html")) {
  const signupForm = document.querySelector("form");

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault(); // Prevent the form from submitting and reloading the page

    const username = document.getElementById("username").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    if (password !== confirmPassword) {
      return showMessage("Passwords do not match", "signUpMessage");
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Send email verification
      await sendEmailVerification(user);
      showMessage("Verification email sent. Please check your inbox.", "signUpMessage");

      // Wait for email verification and then save user data
      auth.onAuthStateChanged(async (user) => {
        if (user && user.emailVerified) {
          const docRef = doc(db, "users", user.uid);
          await setDoc(docRef, { email, username });
          window.location.href = "login.html"; // Redirect to login page
        }
      });

    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        showMessage("Email already in use", "signUpMessage");
      } else {
        showMessage("Error signing up", "signUpMessage");
      }
    }
  });
}

// Handle Login Logic
if (window.location.pathname.includes("login.html")) {
  const loginForm = document.querySelector("form");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault(); // Prevent form submission

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Check if email is verified
      if (!user.emailVerified) {
        return showMessage("Please verify your email first.", "signInMessage");
      }

      showMessage("Login successful", "signInMessage");
      localStorage.setItem("loggedInUserId", user.uid);
      window.location.href = "./Login/loginS.html"; // Redirect after successful login

    } catch (err) {
      if (err.code === "auth/invalid-credential") {
        showMessage("Incorrect email or password", "signInMessage");
      } else {
        showMessage("Login failed", "signInMessage");
      }
    }
  });
}
