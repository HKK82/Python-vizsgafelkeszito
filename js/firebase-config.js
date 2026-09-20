// Firebase web configuration for the classroom progress tracker.
// A Firebase web API key is client-side configuration; access is protected by
// Firebase Authentication and Realtime Database Security Rules.

export const firebaseConfig = {
  apiKey: 'AIzaSyBJVdruiEsphqar-Hs2tTlQhWZMyBWc1B8',
  authDomain: 'python-vizsgafelkeszito.firebaseapp.com',
  databaseURL: 'https://python-vizsgafelkeszito-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'python-vizsgafelkeszito',
  storageBucket: 'python-vizsgafelkeszito.firebasestorage.app',
  messagingSenderId: '560506316227',
  appId: '1:560506316227:web:cd315cc696e00a0c680976'
};

export function isFirebaseConfigured() {
  return !!firebaseConfig.apiKey &&
    !!firebaseConfig.databaseURL &&
    !!firebaseConfig.projectId;
}
