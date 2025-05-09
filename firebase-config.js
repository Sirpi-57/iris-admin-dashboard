// js/firebase-config.js

// --- PASTE YOUR FIREBASE PROJECT CONFIGURATION HERE ---
const firebaseConfig = {
    apiKey: "AIzaSyBw3b7RrcIzL7Otog58Bu52eUH5e3zab8I",
    authDomain: "iris-ai-prod.firebaseapp.com",
    projectId: "iris-ai-prod",
    storageBucket: "iris-ai-prod.firebasestorage.app",
    messagingSenderId: "223585438",
    appId: "1:223585438:web:7ceeb88553e550e1a0c78f",
    measurementId: "G-JF7KVLNXRL"
  };
  // --- END OF CONFIGURATION ---
  
  
  // Initialize Firebase only if it hasn't been initialized yet
  if (!firebase.apps.length) {
      try {
          firebase.initializeApp(firebaseConfig);
          console.log("Firebase initialized successfully (Admin Dashboard).");
      } catch (error) {
          console.error("Firebase initialization error (Admin Dashboard):", error);
          // Optionally display an error to the user on the page
          document.body.innerHTML = '<div style="color: red; padding: 20px;">Critical Error: Could not initialize Firebase. Check console.</div>';
      }
  } else {
      console.log("Firebase already initialized (Admin Dashboard).");
  }
  
  // Get Firebase services (ensure compat libraries are loaded in index.html)
  const auth = firebase.auth();
  const db = firebase.firestore();
  const storage = firebase.storage(); // Firebase Storage instance
  const { serverTimestamp, arrayUnion, arrayRemove, increment } = firebase.firestore.FieldValue; // Destructure FieldValue for easier use
  
  // Export the services and specific FieldValue types for use in other modules
  export { auth, db, storage, serverTimestamp, arrayUnion, arrayRemove, increment };