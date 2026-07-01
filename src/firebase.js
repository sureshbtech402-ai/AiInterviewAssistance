import { initializeApp } from "firebase/app";

import {
    getAuth,
    GoogleAuthProvider
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyACLpBw-wH5bQkNFZyqixoS_HF356cbFho",
  authDomain: "ai-interview-assistant-14f29.firebaseapp.com",
  projectId: "ai-interview-assistant-14f29",
  storageBucket: "ai-interview-assistant-14f29.firebasestorage.app",
  messagingSenderId: "220567457334",
  appId: "1:220567457334:web:086707a83562d16d60d297"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();