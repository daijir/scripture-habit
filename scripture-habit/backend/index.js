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
      const groupIds = userData.groupIds || (userData.groupId ? [userData.groupId] : []);

      if (groupIds.includes(groupId)) throw new Error('User already in this group.');
      if (groupIds.length >= 7) throw new Error('You can only join up to 7 groups.');

      const groupData = groupDoc.data();

      // Check if user is already a member of the group
      if (groupData.members && groupData.members.includes(uid)) {
        if (!groupIds.includes(groupId)) {
          // Inconsistency detected: User is in group members but group is not in user's list.
          // Repair: Add to user's list
          t.update(userRef, {
            groupIds: admin.firestore.FieldValue.arrayUnion(groupId)
          });
          return; // Exit transaction successfully, skipping other updates
        } else {
          throw new Error('User already in this group.');
        }
      }

      if (groupData.membersCount >= groupData.maxMembers) throw new Error('Group is full.');

      t.update(groupRef, {
        members: admin.firestore.FieldValue.arrayUnion(uid),
        membersCount: admin.firestore.FieldValue.increment(1)
      });

      // Update user's groupIds and set groupId to the new one (as "active" or "primary")
      if (!userData.groupIds && userData.groupId) {
        // Migration: User has a group but no groupIds array yet.
        // Initialize array with both the old group and the new group.
        const uniqueIds = [...new Set([userData.groupId, groupId])];
        t.update(userRef, {
          groupIds: uniqueIds,
          groupId: groupId
        });
      } else {
        t.update(userRef, {
          groupIds: admin.firestore.FieldValue.arrayUnion(groupId),
          groupId: groupId
        });
      }

      // Add system message
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

      // Determine which group to leave
      const targetGroupId = groupId || userData.groupId;
      if (!targetGroupId) throw new Error('No group specified to leave.');

      const groupRef = db.collection('groups').doc(targetGroupId);
      const groupDoc = await t.get(groupRef);

      if (groupDoc.exists) {
        t.update(groupRef, {
          members: admin.firestore.FieldValue.arrayRemove(uid),
          membersCount: admin.firestore.FieldValue.increment(-1)
        });
      }

      // Update user data
      const currentGroupIds = userData.groupIds || (userData.groupId ? [userData.groupId] : []);
      const newGroupIds = currentGroupIds.filter(id => id !== targetGroupId);

      let newPrimaryGroupId = userData.groupId;
      if (userData.groupId === targetGroupId) {
        newPrimaryGroupId = newGroupIds.length > 0 ? newGroupIds[0] : null;
      }

      t.update(userRef, {
        groupIds: admin.firestore.FieldValue.arrayRemove(targetGroupId),
        groupId: newPrimaryGroupId
      });

      // Add system message
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


// Delete group - removes group from all members and cleans up data
app.post('/delete-group', async (req, res) => {
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

    // First, get the group and verify ownership
    const groupRef = db.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) {
      return res.status(404).send('Group not found.');
    }

    const groupData = groupDoc.data();

    // Only the owner can delete the group
    if (groupData.ownerUserId !== uid) {
      return res.status(403).send('Only the group owner can delete the group.');
    }

    const members = groupData.members || [];
    console.log(`Deleting group ${groupId} with ${members.length} members`);

    // Step 1: Remove group from all members' groupIds and delete their groupStates
    const batch = db.batch();

    for (const memberId of members) {
      const userRef = db.collection('users').doc(memberId);
      const userDoc = await userRef.get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        const currentGroupIds = userData.groupIds || [];
        const newGroupIds = currentGroupIds.filter(id => id !== groupId);

        // Determine new primary groupId
        let newPrimaryGroupId = userData.groupId;
        if (userData.groupId === groupId) {
          newPrimaryGroupId = newGroupIds.length > 0 ? newGroupIds[0] : '';
        }

        batch.update(userRef, {
          groupIds: admin.firestore.FieldValue.arrayRemove(groupId),
          groupId: newPrimaryGroupId
        });

        // Delete user's groupState for this group
        const groupStateRef = db.collection('users').doc(memberId).collection('groupStates').doc(groupId);
        batch.delete(groupStateRef);
      }
    }

    await batch.commit();
    console.log(`Removed group from ${members.length} members`);

    // Step 2: Delete messages subcollection (in batches of 500)
    const messagesRef = groupRef.collection('messages');
    const messagesSnapshot = await messagesRef.get();

    if (!messagesSnapshot.empty) {
      const messageBatches = [];
      let messageBatch = db.batch();
      let count = 0;

      messagesSnapshot.docs.forEach(doc => {
        messageBatch.delete(doc.ref);
        count++;

        if (count >= 500) {
          messageBatches.push(messageBatch);
          messageBatch = db.batch();
          count = 0;
        }
      });

      if (count > 0) {
        messageBatches.push(messageBatch);
      }

      for (const b of messageBatches) {
        await b.commit();
      }
      console.log(`Deleted ${messagesSnapshot.size} messages`);
    }

    // Step 3: Delete the group document
    await groupRef.delete();
    console.log(`Group ${groupId} deleted successfully`);

    res.status(200).send({ message: 'Group deleted successfully.' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).send(error.message || 'Internal Server Error');
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
