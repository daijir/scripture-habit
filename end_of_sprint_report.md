End-of-Sprint Report

Name: Ivan Sembatya

GitHub Links
- Most recent commit for this sprint:
  - https://github.com/daijir/scripture-habit/commit/f577687e9a3b38112302a1f0662ada3971819306

Task Report (tasks I led)

| Task Name | Estimated hours | Hours worked | Percent complete | Is this blocked by something outside your control? If so, describe. |
|---|---:|---:|---:|---|
| Backend: scaffold Express + Firebase Cloud Function + `/health` endpoint | 6 | 6 | 100% | No |
| Implement backend API to validate and join group (`/join-group`) with ID-token verification | 12 | 14 | 100% | Partially: completed locally; pushing branch to GitHub is blocked by TLS/SSH transport issue outside my control (network / Git config). |
| Resolve merge conflicts with `origin/main` and reconcile Firebase init; update frontend join flow to call backend | 4 | 5 | 100% | No |
| Add root workspace npm scripts to start frontend/backend from workspace root | 1 | 0.5 | 100% | No |

Personal Retrospective

Things I did well (at least one):
1. Resolved merge conflicts and preserved the canonical `origin/main` version where appropriate, keeping the app buildable locally.
2. Scaffolded and implemented a minimal TypeScript + Express backend with a secure `/join-group` route (verifies Firebase ID tokens server-side) and tested the `/health` endpoint locally.
3. Wired the frontend group card to call the backend with an ID token and provided a client-side fallback when the token is not available.

Things I will improve for next week (at least one):
1. Set up the Firebase Emulator locally for end-to-end testing so we can test auth and Firestore against a local instance.
2. Resolve CI/deployment and repository push issues (finish getting branch pushed to GitHub and add a simple GitHub Actions workflow to run lint/tests).

Notes / Blockers
- I implemented the feature and verified it locally, however pushing the branch upstream to GitHub is blocked by a TLS/SSH transport issue. I attempted to switch Git's TLS backend to OpenSSL and to add an SSH remote, but the push still failed (OpenSSL EOF and/or SSH permission denied). If you want, I can help set up an SSH key and push via SSH, or prepare a patch file you can upload.

---
File generated: `end_of_sprint_report.md` in the workspace root. You can paste the contents into your submission form or attach the file as needed.
