import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDW3VoU3NEnLYz_nhCa2sXOROqlhYoDKf0",
  authDomain: "collabradb.firebaseapp.com",
  projectId: "collabradb",
  storageBucket: "collabradb.firebasestorage.app",
  messagingSenderId: "392995172389",
  appId: "1:392995172389:web:25b0714951947471354fcc"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
