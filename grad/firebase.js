// firebase.js - Simple authentication for students

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore, setDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Helper function to show messages
function showMessage(msg, targetId, isError = false) {
  const messageDiv = document.getElementById(targetId);
  if (!messageDiv) return;

  messageDiv.style.display = "block";
  messageDiv.innerHTML = msg;
  
  // Add appropriate styling
  messageDiv.className = `message ${isError ? 'error' : 'success'}`;

  setTimeout(() => {
    messageDiv.style.display = "none";
  }, 5000);
}

// Simple session management
// Add this to your firebase.js file in the onAuthStateChanged function:

onAuthStateChanged(auth, (user) => {
  if (user && user.emailVerified) {
    // User is logged in and verified
    localStorage.setItem("loggedInUserId", user.uid);
    localStorage.setItem("loginTime", Date.now().toString());
    localStorage.setItem("userEmail", user.email); // Add this line for autofill
    console.log("User logged in:", user.email);
    
    // Redirect to profile if on login/register page
    if (window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html')) {
      window.location.href = "profile.html";
    }
  } else if (user && !user.emailVerified) {
    // User exists but email not verified
    localStorage.removeItem("loggedInUserId");
    localStorage.removeItem("loginTime");
    localStorage.removeItem("userEmail"); // Add this line
    console.log("User needs to verify email");
    
    if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html')) {
      alert('Please verify your email before accessing the application.');
      window.location.href = "register.html";
    }
  } else {
    // No user logged in
    localStorage.removeItem("loggedInUserId");
    localStorage.removeItem("loginTime");
    localStorage.removeItem("userEmail"); // Add this line
    console.log("No user logged in");
    
    // Redirect to login if not on public pages
    if (!window.location.pathname.includes('index.html') && 
        !window.location.pathname.includes('login.html') && 
        !window.location.pathname.includes('register.html') &&
        window.location.pathname !== '/') {
      window.location.href = "register.html";
    }
  }
});

// Session timeout check (2 hours)
setInterval(() => {
  const loginTime = localStorage.getItem("loginTime");
  if (loginTime) {
    const timeElapsed = Date.now() - parseInt(loginTime);
    const twoHours = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
    
    if (timeElapsed > twoHours) {
      alert("Session expired. Please log in again.");
      logout();
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// Sign up handler
const signupForm = document.getElementById("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value;
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    if (password !== confirmPassword) {
      return showMessage("Passwords do not match", "signUpMessage", true);
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        email: email,
        username: username,
        createdAt: new Date()
      });

      await sendEmailVerification(user);
      showMessage("Verification email sent. Check your inbox.", "signUpMessage", false);
      
      setTimeout(() => {
        if (window.showLogin) window.showLogin();
      }, 3000);

    } catch (error) {
      let message = "Signup failed";
      if (error.code === "auth/email-already-in-use") message = "Email already in use";
      if (error.code === "auth/weak-password") message = "Password too weak";
      showMessage(message, "signUpMessage", true);
    }
  });
}

// Login handler
const loginForm = document.getElementById("login-form");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    // Basic validation
    if (!email || !password) {
      return showMessage("Please enter both email and password", "signInMessage", true);
    }

    try {
      // Sign in user
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Check if email is verified
      if (!user.emailVerified) {
        showMessage("Please verify your email before logging in.", "signInMessage", true);
        
        // Ask if they want to resend verification email
        setTimeout(() => {
          if (confirm("Would you like us to resend the verification email?")) {
            sendEmailVerification(user)
              .then(() => showMessage("Verification email sent again.", "signInMessage", false))
              .catch(() => showMessage("Failed to send verification email.", "signInMessage", true));
          }
        }, 2000);
        
        return;
      }

      showMessage("Login successful!", "signInMessage", false);

    } catch (error) {
      console.log('Login error:', error);
      
      // Handle different error types
      switch (error.code) {
        case "auth/invalid-credential":
        case "auth/user-not-found":
        case "auth/wrong-password":
          showMessage("Incorrect email or password", "signInMessage", true);
          break;
        case "auth/user-disabled":
          showMessage("This account has been disabled", "signInMessage", true);
          break;
        case "auth/too-many-requests":
          showMessage("Too many failed attempts. Please try again later.", "signInMessage", true);
          break;
        default:
          showMessage("Login error: " + error.message, "signInMessage", true);
      }
    }
  });
}

// logout function
function logout() {
  signOut(auth).then(() => {
    localStorage.removeItem("loggedInUserId");
    localStorage.removeItem("loginTime");
    alert("You have been logged out");
    window.location.href = "index.html";
  }).catch((error) => {
    console.log("Logout error:", error);
    // Clear storage anyway
    localStorage.removeItem("loggedInUserId");
    localStorage.removeItem("loginTime");
    window.location.href = "index.html";
  });
}

// check if user logged in
function isLoggedIn() {
  const userId = localStorage.getItem("loggedInUserId");
  return userId !== null;
}

function getCurrentUserId() {
  return localStorage.getItem("loggedInUserId");
}

async function waitForUID() {
  return getCurrentUserId();
}

// request authentication
async function makeAuthenticatedRequest(url, options = {}) {
  const uid = getCurrentUserId();
  
  if (!uid) {
    throw new Error('User not authenticated');
  }
  
  // add UID to request body for POST/PUT requests
  if (options.method === 'POST' || options.method === 'PUT') {
    const body = options.body ? JSON.parse(options.body) : {};
    body.uid = uid;
    options.body = JSON.stringify(body);
  }
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  return fetch(url, {
    ...options,
    headers
  });
}

async function getUserData() {
  const userId = getCurrentUserId();
  if (!userId) return null;
  
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      return userDoc.data();
    } else {
      return null;
    }
  } catch (error) {
    console.log('Error getting user data:', error);
    return null;
  }
}

// Password reset function with email verification
async function resetPassword(email) {
  if (!email) {
    console.log("No email provided to resetPassword function");
    throw new Error("No email provided");
  }
  
  try {
    // First, check if email exists in our database
    const emailExists = await checkEmailExists(email);
    
    if (!emailExists) {
      // Show error in modal instead of alert
      if (window.showResetStatus) {
        window.showResetStatus("No account found with this email address. Please check your email or sign up for a new account.", true);
      }
      throw new Error("Email not found");
    }
    
    // If email exists, send reset email
    await sendPasswordResetEmail(auth, email);
    
    // Show success in modal instead of alert
    if (window.showResetStatus) {
      window.showResetStatus("Password reset email sent! Check your inbox and spam folder.", false);
      
      // Auto-close modal after 3 seconds
      setTimeout(() => {
        if (window.closeResetModal) {
          window.closeResetModal();
        }
      }, 3000);
    }
    
  } catch (error) {
    console.log('Password reset error:', error);
    
    // Don't throw again if it's our custom "Email not found" error
    if (error.message === "Email not found") {
      return;
    }
    
    let message = "Error sending password reset email";
    
    switch (error.code) {
      case "auth/invalid-email":
        message = "Invalid email address format";
        break;
      case "auth/too-many-requests":
        message = "Too many requests. Please try again later";
        break;
      default:
        message = "Error: " + error.message;
    }
    
    // Show error in modal instead of alert
    if (window.showResetStatus) {
      window.showResetStatus(message, true);
    }
    
    throw error;
  }
}

// Helper function to check if email exists in database
async function checkEmailExists(email) {
  try{
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);
    
    return !querySnapshot.empty;
  } catch (error) {
    console.log('Error checking email:', error);
    // If there's an error checking, proceed with reset anyway
    return true;
  }
}

// Make functions available globally
window.logout = logout;
window.isLoggedIn = isLoggedIn;
window.getCurrentUserId = getCurrentUserId;
window.waitForUID = waitForUID;
window.getUserData = getUserData;
window.resetPassword = resetPassword;
window.makeAuthenticatedRequest = makeAuthenticatedRequest;

// Export for modules
export { auth, db, logout, isLoggedIn, getCurrentUserId, waitForUID, getUserData, makeAuthenticatedRequest, resetPassword };

console.log('Firebase authentication initialized');