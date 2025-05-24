// Common Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Helper
function showMessage(msg, targetId) {
  const messageDiv = document.getElementById(targetId);
  if (!messageDiv) return;

  messageDiv.style.display = "block";
  messageDiv.style.opacity = 1;
  messageDiv.innerHTML = msg;

  setTimeout(() => {
    messageDiv.style.opacity = 0;
  }, 5000);
}

// ==== SIGN UP HANDLER ====
const signupForm = document.getElementById("signup-form");

if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value;
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    if (password !== confirmPassword) {
      return showMessage("Passwords do not match", "signUpMessage");
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), { email, username });

      await sendEmailVerification(user);
      showMessage("Verification email sent. Please check your inbox.", "signUpMessage");

    } catch (err) {
      switch (err.code) {
        case "auth/email-already-in-use":
          showMessage("Email already in use.", "signUpMessage");
          break;
        case "auth/invalid-email":
          showMessage("Invalid email format.", "signUpMessage");
          break;
        case "auth/weak-password":
          showMessage("Password must be at least 6 characters.", "signUpMessage");
          break;
        default:
          showMessage("Signup error: " + err.message, "signUpMessage");
      }
    }
  });
}

// ==== LOGIN HANDLER ====
const loginForm = document.getElementById("login-form");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (!user.emailVerified) {
        return showMessage("Please verify your email before logging in.", "signInMessage");
      }

      localStorage.setItem("loggedInUserId", user.uid);
      window.location.href = "profile.html";

    } catch (err) {
      switch (err.code) {
        case "auth/invalid-credential":
          showMessage("Incorrect email or password", "signInMessage");
          break;
        default:
          showMessage("Login error: " + err.message, "signInMessage");
      }
    }
  });
}