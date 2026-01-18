# Quick Deployment Reference

## One-Time Setup

```bash
# 1. Install dependencies
npm install

# 2. Install Firebase CLI globally
npm install -g firebase-tools

# 3. Login to Firebase
firebase login

# 4. Initialize Firebase (interactive)
firebase init
# Select: Firestore + Hosting
# Public directory: dist
# Single-page app: Yes
```

## Create .env File

Create `.env` in project root with your Firebase config:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## Deploy Commands

```bash
# Deploy Firestore rules and indexes
firebase deploy --only firestore

# Build the project
npm run build

# Deploy hosting
firebase deploy --only hosting

# Or deploy everything at once
firebase deploy
```

## Development

```bash
# Run dev server
npm run dev

# Preview production build
npm run build && npm run preview
```

## Troubleshooting

- **Index errors**: Firebase will provide a link to create indexes automatically
- **Build errors**: Check TypeScript errors with `npm run build`
- **Env vars not working**: Ensure `.env` file exists and variables start with `VITE_`
