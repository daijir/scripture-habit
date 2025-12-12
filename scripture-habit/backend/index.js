const express = require('express');
const path = require('path');
const admin = require('firebase-admin');
const cors = require('cors');
const axios = require('axios'); // Add axios

// Load .env from project root (one level up from backend/ directory)
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("WARNING: GEMINI_API_KEY is not set in environment variables.");
} else {
  console.log(`GEMINI_API_KEY loaded: ${apiKey.substring(0, 4)}...`);
}

const app = express();

app.use(cors());
app.use(express.json());

// Initialize Firebase Admin SDK
// Try to get credentials from environment variables first (Vercel)
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('./serviceAccountKey.json'); // Fallback for local dev

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// API Model Configuration
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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
      if (groupIds.length >= 7) throw new Error('You can only join up to 12 groups.');

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
      .get();

    const groups = [];
    snapshot.forEach(doc => {
      groups.push({ id: doc.id, ...doc.data() });
    });

    // Sort by membersCount ascending (handle missing count as 0)
    groups.sort((a, b) => (a.membersCount || 0) - (b.membersCount || 0));

    // Return top 20
    res.status(200).json(groups.slice(0, 20));
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

// Scraping Endpoint for General Conference Metadata
app.get('/fetch-gc-metadata', async (req, res) => {
  console.log('Received metadata request:', req.query); // Debug log
  const { url, lang } = req.query;

  if (!url) return res.status(400).send({ error: 'URL is required' });

  // Dynamically require axios/cheerio to avoid crashing if they aren't installed (though they should be in root)
  let axios, cheerio;
  try {
    axios = require('axios');
    cheerio = require('cheerio');
  } catch (e) {
    console.error("Missing dependencies for scraping:", e);
    return res.status(500).send({ error: 'Backend missing scraping dependencies.' });
  }

  try {
    const targetUrl = new URL(url);
    if (lang) {
      targetUrl.searchParams.set('lang', lang);
    }

    const response = await axios.get(targetUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);

    // Attempt to find title
    let title = $('h1').first().text().trim();

    // Attempt to find speaker
    let speaker = '';
    // Common selectors for GC talks
    if ($('div.byline p.author-name').length) {
      speaker = $('div.byline p.author-name').first().text().trim();
    } else if ($('p.author-name').length) {
      speaker = $('p.author-name').first().text().trim();
    } else if ($('a.author-name').length) {
      speaker = $('a.author-name').first().text().trim();
    } else if ($('.speaker-name').length) {
      speaker = $('.speaker-name').text().trim();
    }

    // Clean up title/speaker if needed
    // e.g., remove "By " prefix if present? usually raw text is fine.

    res.json({ title, speaker });
  } catch (error) {
    console.error('Error scraping GC:', error.message);
    res.status(500).json({ error: 'Failed to fetch metadata' });
  }
});


// AI Ponder Questions Endpoint
app.post('/generate-ponder-questions', async (req, res) => {
  const { scripture, chapter, language } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API Key is not configured.' });
  }

  if (!scripture || !chapter) {
    return res.status(400).json({ error: 'Scripture and chapter are required.' });
  }

  try {
    const langCode = language || 'en';
    let prompt = '';

    if (langCode === 'ja') {
      prompt = `あなたは末日聖徒イエス・キリスト教会の「わたしに従ってきなさい」の学習ガイドです。
ユーザーが「${scripture} ${chapter}」を読んでいます。
この章について、深く考えるための質問（Ponder Question）を1つだけ提案してください。
箇条書きの記号（*や-など）は使わず、質問文のみをプレーンテキストで出力してください。
霊的な洞察を促す、心に響く質問にしてください。`;
    } else {
      prompt = `You are a "Come, Follow Me" study guide for The Church of Jesus Christ of Latter-day Saints.
The user is reading "${scripture} ${chapter}".
Please suggest 1 Ponder Question to help them think deeply about this chapter.
Do NOT use bullet points or markdown (*, -). Output only the question text.
Make it spiritually thought-provoking.`;
    }

    const apiUrl = `${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`;

    const response = await axios.post(apiUrl, {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    });

    const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('No content generated from Gemini.');
    }

    res.json({ questions: generatedText });

  } catch (error) {
    console.error('Error generating AI questions:', error.message);
    if (error.response) {
      console.error('Gemini API Error Response:', JSON.stringify(error.response.data, null, 2));
    }
    res.status(500).json({ error: 'Failed to generate questions.', details: error.message });
  }
});

// AI Discussion Starter Endpoint
app.post('/generate-discussion-topic', async (req, res) => {
  const { language } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API Key is not configured.' });
  }

  try {
    const langCode = language || 'en';
    let prompt = '';

    if (langCode === 'ja') {
      prompt = `あなたは末日聖徒イエス・キリスト教会の聖典学習グループのファシリテーターです。
グループのメンバーが互いの経験や証を分かち合いたくなるような、話し合いのきっかけとなる質問を1つだけ提案してください。
特定の聖句に限定せず、「今週の学習で」「最近の生活で」といった幅広い文脈で、しかし霊的な深まりをもたらす質問にしてください。
例：「今週、主の助けを感じた瞬間はありましたか？」など。
箇条書きの記号（*や-など）は使わず、質問文のみをプレーンテキストで出力してください。`;
    } else {
      prompt = `You are a facilitator for a scripture study group of The Church of Jesus Christ of Latter-day Saints.
Please suggest 1 discussion starter question that encourages members to share their experiences and testimonies.
Make the question broad enough (e.g., "In your study this week...", "In your life recently...") but spiritually meaningful.
Do NOT use bullet points or markdown (*, -). Output only the question text.`;
    }

    const apiUrl = `${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`;

    const response = await axios.post(apiUrl, {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    });

    const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('No content generated from Gemini.');
    }

    res.json({ topic: generatedText.trim() });

  } catch (error) {
    console.error('Error generating discussion topic:', error.message);
    res.status(500).json({ error: 'Failed to generate topic.', details: error.message });
  }
});

// AI Weekly Recap Endpoint
app.post('/generate-weekly-recap', async (req, res) => {
  const { groupId, language } = req.body;

  if (!groupId) {
    return res.status(400).json({ error: 'Group ID is required.' });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API Key is not configured.' });
  }

  try {
    const db = admin.firestore();
    const messagesRef = db.collection('groups').doc(groupId).collection('messages');

    // Calculate date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const timestamp7DaysAgo = admin.firestore.Timestamp.fromDate(sevenDaysAgo);

    // Query notes from last 7 days
    const snapshot = await messagesRef
      .where('createdAt', '>=', timestamp7DaysAgo)
      .get();

    const notes = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Collect both 'isNote' (legacy) and 'isEntry' (new)
      if (data.isNote || data.isEntry) {
        // Anonymize: only take text/content
        if (data.text) {
          notes.push(data.text);
        }
      }
    });

    if (notes.length === 0) {
      return res.json({ message: 'No notes found for this week, skipping recap.' });
    }

    // Check frequency limit (once per week)
    const groupRef = db.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();
    const groupData = groupDoc.data();

    if (groupData.lastRecapGeneratedAt) {
      const lastGenerated = groupData.lastRecapGeneratedAt.toDate();
      const now = new Date();
      const diffTime = Math.abs(now - lastGenerated);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 7) {
        return res.status(429).json({
          error: 'Weekly recap can only be generated once a week.',
          nextAvailable: new Date(lastGenerated.getTime() + 7 * 24 * 60 * 60 * 1000)
        });
      }
    }

    const langCode = language || 'en';
    let prompt = '';
    const notesText = notes.join("\n\n---\n\n");

    if (langCode === 'ja') {
      prompt = `あなたは末日聖徒イエス・キリスト教会の聖典学習グループのアナウンサーです。
以下は、グループメンバーが過去1週間に共有した（匿名の）学習ノートの内容です。
これらを分析し、グループ全体の「学習トレンド」や「深まっているテーマ」について、短く励ましとなるようなレポートを作成してください。
出力形式:
「今週の振り返り：」で始め、その後に分析結果を続けてください。
例：「今週の振り返り：今週はグループ全体で『祈り』についての学びが深まっているようです！多くのメンバーがアルマ書から主の憐れみについて感じています。」
特定の個人の名前や詳細なプライバシーには触れず、ポジティブな全体の傾向を伝えてください。
です・ます常体で、親しみやすく記述してください。

ノート内容:
${notesText}`;
    } else {
      prompt = `You are an announcer for a scripture study group of The Church of Jesus Christ of Latter-day Saints.
Below are the (anonymized) study notes shared by group members over the past week.
Analyze them and create a short, encouraging report on the group's "learning trends" or "deepening themes".
Output Format:
Start with "Weekly Reflection:", followed by your analysis.
Example: "Weekly Reflection: This week, the group seems to be deepening their understanding of 'Prayer'! Many members are feeling the Lord's mercy from the Book of Alma."
Do not mention specific individual names or private details. Focus on positive overall trends.
Keep it friendly and uplifting.

Notes Content:
${notesText}`;
    }

    const apiUrl = `${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`;

    const response = await axios.post(apiUrl, {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    });

    const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('No content generated from Gemini.');
    }

    // Save the system message
    const batch = db.batch();
    const newMessageRef = messagesRef.doc();
    batch.set(newMessageRef, {
      text: generatedText.trim(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      senderId: 'system',
      isSystemMessage: true,
      messageType: 'weeklyRecap',
      messageData: {
        weekOf: new Date().toISOString()
      }
    });

    // Update last generated timestamp
    batch.update(groupRef, {
      lastRecapGeneratedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    res.json({ message: 'Weekly recap generated successfully.', recap: generatedText });

  } catch (error) {
    console.error('Error generating weekly recap:', error.message);
    res.status(500).json({ error: 'Failed to generate recap.', details: error.message });
  }
});

app.post('/generate-personal-weekly-recap', async (req, res) => {
  const { uid, language } = req.body;

  if (!uid) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  try {
    const notesRef = db.collection('users').doc(uid).collection('notes');

    // Calculate date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const timestamp7DaysAgo = admin.firestore.Timestamp.fromDate(sevenDaysAgo);

    // Query notes from last 7 days
    const snapshot = await notesRef
      .where('createdAt', '>=', timestamp7DaysAgo)
      .get();

    const notes = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.comment) {
        notes.push(`[${data.scripture || 'Scripture'} - ${data.chapter || ''}] ${data.comment}`);
      } else if (data.text) {
        notes.push(data.text);
      }
    });

    if (notes.length === 0) {
      return res.status(200).json({ recap: null, message: 'No notes found for this week.' });
    }

    const langCode = language || 'en';
    let prompt = '';
    const notesText = notes.join("\n\n---\n\n");

    if (langCode === 'ja') {
      prompt = `あなたは個人の聖典学習のアシスタントです。
以下は、ユーザーが過去1週間に記録した学習ノートの内容です。
これらを分析し、ユーザーのための「個人的な学習の振り返り」を作成してください。
深まっているテーマ、繰り返し出てくる聖句、または感情の変化などに注目し、励ましとなるようなフィードバックをしてください。

出力形式:
タイトル：📅 今週の学習成果（${new Date().toLocaleDateString('ja-JP')}）
1. 深まったテーマ：
2. ピックアップ聖句：
3. 素晴らしい点：
4. 次週へのヒント：

です・ます常体で、親しみやすく記述してください。

ノート内容:
${notesText}`;
    } else {
      prompt = `You are a personal scripture study assistant.
Below are the study notes recorded by the user over the past week.
Analyze these and create a "Personal Study Reflection" for the user.
Focus on deepened themes, recurring scriptures, or changes in emotions, and provide encouraging feedback.

Output Format:
Title: 📅 Weekly Study Harvest (${new Date().toLocaleDateString()})
1. Deepened Themes:
2. Highlighted Scriptures:
3. What went well:
4. Tips for next week:

Keep the tone friendly, encouraging, and respectful.

Notes Content:
${notesText}`;
    }

    const apiUrl = `${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`;

    const response = await axios.post(apiUrl, {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    });

    const generatedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('No content generated from Gemini.');
    }

    res.status(200).json({ recap: generatedText.trim() });

  } catch (error) {
    console.error('Error generating personal recap:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to generate personal recap.' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT} `);
});
