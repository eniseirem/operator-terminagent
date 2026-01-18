# Firebase Setup Guide

## Prerequisites

1. Node.js and npm installed
2. Firebase account (free tier works)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
cd /Users/eniseiremcolak/Desktop/projects/operator-terminagent
npm install
```

If you encounter npm log errors, try:
```bash
npm install --cache /tmp/npm-cache
```

### 2. Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click "Add project" or select existing project
3. Follow the setup wizard
4. Enable **Firestore Database**:
   - Go to "Firestore Database" in left sidebar
   - Click "Create database"
   - Start in **test mode** (we'll update rules)
   - Choose a location (e.g., us-central1)

### 3. Get Firebase Configuration

1. In Firebase Console, go to Project Settings (gear icon)
2. Scroll down to "Your apps" section
3. Click the web icon (`</>`) to add a web app
4. Register app (name it "Operator Terminagent")
5. Copy the Firebase configuration object

### 4. Create Environment File

Create a `.env` file in the project root:

```bash
cd /Users/eniseiremcolak/Desktop/projects/operator-terminagent
cat > .env << 'EOF'
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
EOF
```

Replace the placeholder values with your actual Firebase config values.

### 5. Install Firebase CLI

```bash
npm install -g firebase-tools
```

### 6. Login to Firebase

```bash
firebase login
```

This will open a browser window for authentication.

### 7. Initialize Firebase

```bash
cd /Users/eniseiremcolak/Desktop/projects/operator-terminagent
n```

**When prompted:**

1. **Select features:** Choose:
   - ✅ Firestore (use arrow keys + space to select)
   - ✅ Hosting
   - Press Enter to continue

2. **Select a Firebase project:**
   - Select your existing project (or create new one)

3. **Firestore Rules file:** 
   - Press Enter to accept `firestore.rules` (already exists)

4. **Firestore indexes file:**
   - Press Enter to accept `firestore.indexes.json` (already exists)

5. **What do you want to use as your public directory?**
   - Type: `dist`
   - Press Enter

6. **Configure as a single-page app?**
   - Type: `Yes`
   - Press Enter

7. **Set up automatic builds and deploys with GitHub?**
   - Type: `No`
   - Press Enter

8. **File dist/index.html already exists. Overwrite?**
   - Type: `No`
   - Press Enter

### 8. Deploy Firestore Rules and Indexes

```bash
firebase deploy --only firestore
```

This will:
- Deploy security rules
- Create composite indexes (may take a few minutes)

### 9. Build the Project

```bash
npm run build
```

This creates the `dist` folder with production build.

### 10. Deploy to Firebase Hosting

```bash
firebase deploy --only hosting
```

Or deploy everything:
```bash
firebase deploy
```

### 11. Verify Deployment

After deployment, Firebase will provide a hosting URL like:
```
https://your-project-id.web.app
```

Visit the URL to test the game!

## Troubleshooting

### Firestore Indexes

If you see index errors, Firebase will provide a link to create them automatically. Click the link and wait for indexes to build.

### Environment Variables

Make sure `.env` file exists and has correct values. Vite only reads variables prefixed with `VITE_`.

### Build Errors

If TypeScript errors occur:
```bash
npm run build 2>&1 | grep error
```

Check `src/` files for type errors.

## Development

To run locally during development:

```bash
npm run dev
```

Visit `http://localhost:5173` (or the port shown in terminal).

## Next Steps After Deployment

1. Test the game and submit a run
2. Check Firestore Console to see runs being created
3. Verify leaderboard updates in real-time
4. Check stats panel shows correct data

## Security Notes

- Firestore rules prevent clients from updating/deleting runs
- All inputs are validated server-side
- `createdAt` must use server timestamp (enforced by rules)
