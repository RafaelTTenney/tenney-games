import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// TODO: Replace the placeholder values with your Firebase web app config.
export const firebaseConfig = {
  apiKey: 'AIzaSyBLsZ01PABy0jY2AkHL-oDNoNZDH88DtF4',
  authDomain: 'tenney-games.firebaseapp.com',
  projectId: 'tenney-games',
  storageBucket: 'tenney-games.firebasestorage.app',
  messagingSenderId: '806436376025',
  appId: '1:806436376025:web:0dd25fc4abc3901db4ddc8'
};

export function hasFirebaseConfig() {
  return (
    firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.includes('YOUR_FIREBASE')
  );
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

let authReadyPromise = null;

export function waitForAuth() {
  if (!hasFirebaseConfig()) return Promise.resolve(null);
  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, (user) => {
        unsub();
        resolve(user || null);
      }, () => resolve(null));
    });
  }
  return authReadyPromise;
}
