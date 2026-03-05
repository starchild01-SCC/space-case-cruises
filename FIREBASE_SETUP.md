# Firebase Authentication Setup Guide

Firebase has been integrated with your Space Case Cruises app! Here's how to configure it:

## 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard

## 2. Enable Authentication Methods

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable:
   - **Email/Password** (for email sign-in)
   - **Google** (for Google sign-in)

## 3. Get Frontend Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll to "Your apps" section
3. Click "Web" app or add one if you haven't
4. Copy the config values

Create or update `ui/.env`:

```bash
VITE_API_BASE_URL=http://localhost:4000

# Firebase Frontend Config
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456:web:abcdef
```

## 4. Get Backend Configuration (Service Account)

1. In Firebase Console, go to **Project Settings** → **Service accounts**
2. Click "Generate new private key"
3. Download the JSON file
4. Save it as `firebase-service-account.json` in your project root
5. **Important:** Add this to `.gitignore` to keep it private!

Update your `.env` in the root:

```bash
PORT=4000
DATABASE_URL=postgresql://...

# Firebase Backend Config
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-project-id",...}
```

**OR** use file path (easier for local development):

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT=./firebase-service-account.json
```

## 5. Update `.gitignore`

Add these lines to `.gitignore`:

```
firebase-service-account.json
.env
ui/.env
```

## 6. Test the Setup

1. Start the backend: `npm run dev`
2. Start the frontend: `cd ui && npm run dev`
3. Open the app in your browser
4. Click "SIGN IN / SIGN UP"
5. Try:
   - Creating an account with email/password
   - Signing in with email/password
   - Signing in with Google

## 7. Auth Modes

Your app supports three authentication modes:

1. **Firebase** (when Firebase is configured) - Real authentication
2. **Supabase** (when Supabase is configured) - Legacy support
3. **Header-sim** (fallback) - Development simulation mode

The backend automatically detects which mode to use based on environment variables.

## 8. First Admin User

After Firebase is configured, create your first admin account:

1. Sign up with your email
2. Manually update the database to set `role = 'admin'`:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

## Production Deployment

For production (Railway, Render, etc.):

1. Add all environment variables to your hosting platform
2. For `FIREBASE_SERVICE_ACCOUNT`, paste the entire JSON as a string (not a file path)
3. Make sure Firebase Authentication domain is authorized in Firebase Console

## Troubleshooting

**"Firebase not configured" error:**
- Check that all environment variables are set
- Restart both dev servers after adding env vars

**"Invalid token" error:**
- Make sure frontend and backend use the same Firebase project
- Check that the service account JSON is valid

**Google sign-in doesn't work:**
- Enable Google provider in Firebase Console
- Add your domain to authorized domains in Firebase Console (Authentication → Settings)

## Need Help?

Check the Firebase docs: https://firebase.google.com/docs/auth
