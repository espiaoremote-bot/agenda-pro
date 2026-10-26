import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyDMuuOP4DuhfbLajEW1VryXlSTAUzh4SU0",
  authDomain: "agenda-pro-2905b.firebaseapp.com",
  projectId: "agenda-pro-2905b",
  storageBucket: "agenda-pro-2905b.firebasestorage.app",
  messagingSenderId: "145717674967",
  appId: "1:145717674967:web:ebd7cf0d4dd6e25450c192",
  measurementId: "G-63QTX0M7BV"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export { analytics };