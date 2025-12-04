// Migration script to fix typo: "Convenants" -> "Covenants"
// Run with: node backend/fix-convenants-typo.js

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixTypoInNotes() {
    console.log('🔧 Starting typo fix migration: Convenants -> Covenants');

    let notesFixed = 0;
    let messagesFixed = 0;

    // 1. Fix user notes
    console.log('\n📝 Fixing user notes...');
    const usersSnapshot = await db.collection('users').get();

    for (const userDoc of usersSnapshot.docs) {
        const notesRef = db.collection('users').doc(userDoc.id).collection('notes');
        const notesSnapshot = await notesRef.get();

        for (const noteDoc of notesSnapshot.docs) {
            const data = noteDoc.data();
            let needsUpdate = false;
            const updates = {};

            // Check scripture field
            if (data.scripture === 'Doctrine and Convenants') {
                updates.scripture = 'Doctrine and Covenants';
                needsUpdate = true;
            }

            // Check text field
            if (data.text && data.text.includes('Doctrine and Convenants')) {
                updates.text = data.text.replace(/Doctrine and Convenants/g, 'Doctrine and Covenants');
                needsUpdate = true;
            }

            if (needsUpdate) {
                await noteDoc.ref.update(updates);
                notesFixed++;
                console.log(`  ✅ Fixed note ${noteDoc.id} for user ${userDoc.id}`);
            }
        }
    }

    // 2. Fix group messages
    console.log('\n💬 Fixing group messages...');
    const groupsSnapshot = await db.collection('groups').get();

    for (const groupDoc of groupsSnapshot.docs) {
        const messagesRef = db.collection('groups').doc(groupDoc.id).collection('messages');
        const messagesSnapshot = await messagesRef.get();

        for (const msgDoc of messagesSnapshot.docs) {
            const data = msgDoc.data();

            if (data.text && data.text.includes('Doctrine and Convenants')) {
                await msgDoc.ref.update({
                    text: data.text.replace(/Doctrine and Convenants/g, 'Doctrine and Covenants')
                });
                messagesFixed++;
                console.log(`  ✅ Fixed message ${msgDoc.id} in group ${groupDoc.id}`);
            }
        }
    }

    console.log('\n✨ Migration complete!');
    console.log(`   Notes fixed: ${notesFixed}`);
    console.log(`   Messages fixed: ${messagesFixed}`);
}

fixTypoInNotes()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    });
