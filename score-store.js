import { auth, db, hasFirebaseConfig, waitForAuth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

function waitForUser(timeoutMs = 1500) {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      unsub();
      resolve(null);
    }, timeoutMs);
    const unsub = onAuthStateChanged(auth, (user) => {
      if (done) return;
      if (user) {
        done = true;
        clearTimeout(timer);
        unsub();
        resolve(user);
      }
    }, () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      unsub();
      resolve(null);
    });
  });
}

async function getUserId() {
  if (!hasFirebaseConfig()) return null;
  if (auth.currentUser) return auth.currentUser.uid;
  const user = await waitForAuth();
  if (user?.uid) return user.uid;
  const lateUser = await waitForUser();
  return lateUser?.uid || null;
}

async function fetchHighScore(userId, gameId) {
  const docId = `${userId}_${gameId}`;
  const docRef = doc(db, 'highScores', docId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    try {
      await setDoc(docRef, {
        uid: userId,
        gameId,
        score: 0,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.warn('High score init failed', err);
    }
    return 0;
  }
  const score = snap.data()?.score;
  return typeof score === 'number' ? score : 0;
}

export async function getHighScore(gameId) {
  const userId = await getUserId();
  if (!userId) {
    console.warn('High score read skipped: no authenticated user.');
    return 0;
  }
  return fetchHighScore(userId, gameId);
}

export async function submitHighScore(gameId, score) {
  const userId = await getUserId();
  if (!userId) {
    console.warn('High score save skipped: no authenticated user.');
    return null;
  }
  const docId = `${userId}_${gameId}`;
  const docRef = doc(db, 'highScores', docId);
  let result = score;
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(docRef);
      const current = snap.exists() ? snap.data()?.score || 0 : 0;
      if (score <= current) {
        result = current;
        return;
      }
      tx.set(docRef, {
        uid: userId,
        gameId,
        score,
        updatedAt: serverTimestamp()
      }, { merge: true });
      result = score;
    });
  } catch (err) {
    console.error('High score save failed', err);
  }
  return result;
}

export async function submitLowScore(gameId, score) {
  const userId = await getUserId();
  if (!userId) {
    console.warn('Low score save skipped: no authenticated user.');
    return null;
  }
  const docId = `${userId}_${gameId}`;
  const docRef = doc(db, 'highScores', docId);
  let result = score;
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(docRef);
      const current = snap.exists() ? snap.data()?.score || 0 : 0;
      if (current > 0 && score >= current) {
        result = current;
        return;
      }
      tx.set(docRef, {
        uid: userId,
        gameId,
        score,
        updatedAt: serverTimestamp()
      }, { merge: true });
      result = score;
    });
  } catch (err) {
    console.error('Low score save failed', err);
  }
  return result;
}
