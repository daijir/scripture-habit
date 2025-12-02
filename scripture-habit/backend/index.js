const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
require('dotenv').config();

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();
app.use(cors());
app.use(express.json());

app.post('/verify-login', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).send('ID token is required.');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    const email = decodedToken.email;

    console.log('Verified user:', { uid, email });

    
    

    res.status(200).send({ message: 'Login verified successfully.', user: { uid, email } });
  } catch (error) {
    console.error('Error verifying ID token:', error);
    res.status(401).send('Unauthorized: Invalid ID token.');
  }
});


app.post('/join-group', async (req, res) => {
  const { token } = req.body; 
  
  
  
  
  const authHeader = req.headers.authorization;
  let idToken;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    idToken = authHeader.split('Bearer ')[1];
  } else if (req.body.token) {
    idToken = req.body.token;
  } else {
    return res.status(401).send('Unauthorized: No token provided.');
  }

  const { groupId } = req.body;
  if (!groupId) return res.status(400).send('Group ID is required.');

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const db = admin.firestore();

    await db.runTransaction(async (t) => {
      const userRef = db.collection('users').doc(uid);
      const groupRef = db.collection('groups').doc(groupId);

      const userDoc = await t.get(userRef);
      const groupDoc = await t.get(groupRef);

      if (!groupDoc.exists) throw new Error('Group not found.');
      
      const userData = userDoc.data();
      if (userData.groupId) throw new Error('User already in a group.');
      
      const groupData = groupDoc.data();
      if (groupData.members && groupData.members.includes(uid)) throw new Error('User already in this group.');
      if (groupData.membersCount >= groupData.maxMembers) throw new Error('Group is full.');

      t.update(groupRef, {
        members: admin.firestore.FieldValue.arrayUnion(uid),
        membersCount: admin.firestore.FieldValue.increment(1)
      });
      t.update(userRef, {
        groupId: groupId
      });

      
      const messagesRef = groupRef.collection('messages').doc();
      t.set(messagesRef, {
        text: `👋 **${userData.nickname || 'A user'}** joined the group!`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        senderId: 'system',
        isSystemMessage: true,
        type: 'join'
      });
    });

    res.status(200).send({ message: 'Successfully joined group.' });
  } catch (error) {
    console.error('Error joining group:', error);
    res.status(500).send(error.message || 'Internal Server Error');
  }
});


app.post('/leave-group', async (req, res) => {
  const authHeader = req.headers.authorization;
  let idToken;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    idToken = authHeader.split('Bearer ')[1];
  } else if (req.body.token) {
    idToken = req.body.token;
  } else {
    return res.status(401).send('Unauthorized: No token provided.');
  }

  const { groupId } = req.body; 
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const db = admin.firestore();

    await db.runTransaction(async (t) => {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await t.get(userRef);
      
      if (!userDoc.exists) throw new Error('User not found.');
      const userData = userDoc.data();
      
      const currentGroupId = groupId || userData.groupId;
      if (!currentGroupId) throw new Error('User is not in a group.');
      
      
      if (groupId && userData.groupId !== groupId) {
         
         
         
      }

      const groupRef = db.collection('groups').doc(currentGroupId);
      const groupDoc = await t.get(groupRef);

      if (groupDoc.exists) {
        t.update(groupRef, {
          members: admin.firestore.FieldValue.arrayRemove(uid),
          membersCount: admin.firestore.FieldValue.increment(-1)
        });
      }
      
      t.update(userRef, {
        groupId: null
      });

      
      if (groupDoc.exists) {
        const messagesRef = groupRef.collection('messages').doc();
        t.set(messagesRef, {
          text: `🚪 **${userData.nickname || 'A user'}** left the group.`,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          senderId: 'system',
          isSystemMessage: true,
          type: 'leave'
        });
      }
    });

    res.status(200).send({ message: 'Successfully left group.' });
  } catch (error) {
    console.error('Error leaving group:', error);
    res.status(500).send(error.message || 'Internal Server Error');
  }
});


app.get('/groups', async (req, res) => {
  try {
    const db = admin.firestore();
    const groupsRef = db.collection('groups');
    
    const snapshot = await groupsRef
      .where('isPublic', '==', true)
      .where('membersCount', '<', 5)
      .get();

    const groups = [];
    snapshot.forEach(doc => {
      groups.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).send('Error fetching groups.');
  }
});


app.post('/migrate-data', async (req, res) => {
  
  
  console.log('Starting data migration on backend...');
  const db = admin.firestore();
  
  try {
    
    const groupsSnapshot = await db.collection('groups').get();
    console.log(`Found ${groupsSnapshot.size} groups.`);
    let messagesMigrated = 0;

    for (const groupDoc of groupsSnapshot.docs) {
      const messagesRef = groupDoc.ref.collection('messages');
      
      const messagesSnapshot = await messagesRef.where('isEntry', '==', true).get();

      if (messagesSnapshot.empty) continue;

      const batch = db.batch();
      let batchCount = 0;

      messagesSnapshot.forEach(doc => {
        
        if (doc.data().isNote === undefined) {
            batch.update(doc.ref, { isNote: true });
            batchCount++;
            messagesMigrated++;
        }
      });

      if (batchCount > 0) {
        await batch.commit();
        console.log(`Migrated ${batchCount} messages in group ${groupDoc.id}`);
      }
    }

    
    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} users.`);
    let usersMigrated = 0;

    const userBatch = db.batch();
    let userBatchCount = 0;

    usersSnapshot.forEach(userDoc => {
      const data = userDoc.data();
      if (data.totalEntries !== undefined && data.totalNotes === undefined) {
        userBatch.update(userDoc.ref, { totalNotes: data.totalEntries });
        userBatchCount++;
        usersMigrated++;
      }
    });

    if (userBatchCount > 0) {
      await userBatch.commit();
    }

    console.log('Migration complete.');
    res.status(200).json({ 
      message: 'Migration complete', 
      stats: { 
        messagesMigrated, 
        usersMigrated 
      } 
    });

  } catch (error) {
    console.error('Migration failed:', error);
    res.status(500).send('Migration failed: ' + error.message);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
