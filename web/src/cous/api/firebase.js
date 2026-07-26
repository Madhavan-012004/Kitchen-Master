// Firebase Setup Guide (CDN Version)
// These fields MUST be exactly what is in your Firebase Console
export const firebaseConfig = {
  apiKey: "AIzaSyC8BytjYh_E5-McPr-J-4-h58YUY5BvBs4",
  authDomain: "kitchen-master-7ac51.firebaseapp.com",
  projectId: "kitchen-master-7ac51",
  storageBucket: "kitchen-master-7ac51.firebasestorage.app",
  messagingSenderId: "223106997232",
  appId: "1:223106997232:web:543a6df41c89aafa5f5b35",
  measurementId: "G-EVV0H8TRYR"
};

// Helper to get Firebase when ready
export const getFirebaseAuth = () => {
    if (!window.firebase) {
        console.error("Firebase CDN not loaded yet!");
        return null;
    }
    if (!window.firebase.apps.length) {
        window.firebase.initializeApp(firebaseConfig);
    }
    return window.firebase.auth();
};
