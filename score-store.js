import { auth, db, hasFirebaseConfig, waitForAuth } from './firebase.js';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

async function getUserId() {
  if (!hasFirebaseConfig()) return null;
  if (auth.currentUser) return auth.currentUser.uid;
  const user = await waitForAuth();
  return user?.uid || null;
}

async function fetchHighScore(userId, gameId) {
  const docId = `${userId}_${gameId}`;
  const snap = await getDoc(doc(db, 'highScores', docId));
  if (!snap.exists()) return 0;
  const score = snap.data()?.score;
  return typeof score === 'number' ? score : 0;
}

export async function getHighScore(gameId) {
  const userId = await getUserId();
  if (!userId) return 0;
  return fetchHighScore(userId, gameId);
}

export async function submitHighScore(gameId, score) {
  const userId = await getUserId();
  if (!userId) return null;
  const docId = `${userId}_${gameId}`;
  const docRef = doc(db, 'highScores', docId);
  let result = score;
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
  return result;
}

export async function submitLowScore(gameId, score) {
  const userId = await getUserId();
  if (!userId) return null;
  const docId = `${userId}_${gameId}`;
  const docRef = doc(db, 'highScores', docId);
  let result = score;
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
  return result;
}
