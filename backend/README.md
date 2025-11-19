# Scripture Habit — Backend (Firebase Functions)

This folder contains a minimal Firebase Cloud Functions scaffold (TypeScript + Express) with example endpoints.

Quick start (local):

1. Install deps:

```powershell
Set-Location 'c:\Users\DELL\Desktop\senior-project\scripture-habit\backend'
npm install
```

2. Local dev (run express in ts-node-dev):

```powershell
npm run dev
```

3. Emulate and deploy using Firebase CLI:

```powershell
# install firebase-tools if you haven't
npm install -g firebase-tools
# login and select project
firebase login
firebase init functions
# choose TypeScript, then copy these sources into functions/src
firebase emulators:start --only functions,firestore
firebase deploy --only functions
```

Notes:
- This code expects Firestore collections `groups` and `groups/{id}/members`.
- For local admin access, set `GOOGLE_APPLICATION_CREDENTIALS` to a service account JSON.
- Don't commit service account credentials.
