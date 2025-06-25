// src/firebase.js

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // ✅ this is what connects Firestore
import { getDatabase } from "firebase/database"; // <-- Add this import

// Your Firebase config (keep private in production!)
const firebaseConfig = {
  apiKey: "AIzaSyDtPcRHU50qCiiqBiQBVpvR6sZX0GB6wp4",
  authDomain: "trashmidfuego.firebaseapp.com",
  projectId: "trashmidfuego",
  storageBucket: "trashmidfuego.firebasestorage.app",
  messagingSenderId: "976420437108",
  appId: "1:976420437108:web:c1bb5ca6c07c2266bb2521"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ Initialize Firestore and export it
const db = getFirestore(app);
const rtdb = getDatabase(app); // <-- Add this line

export { db, rtdb }; // <-- Export rtdb
