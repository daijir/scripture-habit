/*
  One-off migration script: copy `public: true` -> `isPublic: true` for group docs.
  Usage (from backend folder):
    node scripts/migratePublic.js

  Notes:
  - Requires firebase-admin credentials available to the process (GOOGLE_APPLICATION_CREDENTIALS or running in an environment
    where admin.initializeApp() works). If you run the backend dev server with credentials the script will work the same.
  - This script is safe: it will only set `isPublic: true` when `public === true` and `isPublic` is missing or false.
*/

const admin = require('firebase-admin');

try {
  admin.initializeApp();
} catch (e) {
  // ignore if already initialized
}

const db = admin.firestore();

async function migrate() {
  console.log('Scanning groups for `public: true`...');
  const snap = await db.collection('groups').where('public', '==', true).get();
  if (snap.empty) {
    console.log('No groups found with `public: true`.');
    return;
  }

  console.log(`Found ${snap.size} groups to check.`);
  let updated = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.isPublic) {
      continue;
    }
    try {
      await doc.ref.update({ isPublic: true });
      console.log(`Updated ${doc.id} -> set isPublic:true`);
      updated++;
    } catch (err) {
      console.error(`Failed to update ${doc.id}:`, err);
    }
  }
  console.log(`Migration complete. Updated ${updated} documents.`);
}

migrate().catch((e) => { console.error('Migration failed:', e); process.exit(1); });
