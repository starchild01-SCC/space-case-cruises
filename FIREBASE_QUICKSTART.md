# Firebase Integration - Quick Reference

## ✅ What's Done

Firebase Authentication is now fully integrated with your Space Case Cruises app!

### Backend Changes
- ✅ Firebase Admin SDK installed
- ✅ Token verification middleware added
- ✅ Auto-provision users from Firebase auth
- ✅ Support for Firebase + Supabase + header-sim modes

### Frontend Changes
- ✅ Firebase SDK installed
- ✅ Email/Password sign-in
- ✅ Email/Password sign-up
- ✅ Google OAuth sign-in
- ✅ Sign-out functionality
- ✅ Auth state persistence
- ✅ Bearer token in API requests

### Files Created
- `src/auth/firebase.ts` - Backend Firebase integration
- `ui/src/firebase.ts` - Frontend Firebase integration
- `FIREBASE_SETUP.md` - Detailed setup guide
- Updated `.env.example` files with Firebase config

## 🚀 Next Steps

### 1. Set Up Firebase (5 minutes)

Go to https://console.firebase.google.com/

1. **Create project** → Name it "Space Case Cruises"
2. **Authentication** → Enable:
   - Email/Password ✓
   - Google ✓
3. **Project Settings** → Add web app → Copy config
4. **Service accounts** → Generate private key → Download JSON

### 2. Configure Environment Variables

**Backend** (root `.env`):
```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT=./firebase-service-account.json
```

**Frontend** (`ui/.env`):
```bash
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456:web:abcdef
```

### 3. Test It

```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Start frontend
cd ui && npm run dev
```

Click "SIGN IN / SIGN UP" → Try creating an account!

## 📝 Auth Flow

1. User clicks "Sign In / Sign Up"
2. Enters email/password or clicks Google
3. Firebase handles authentication
4. Frontend gets ID token
5. Token sent to backend as `Authorization: Bearer <token>`
6. Backend verifies token with Firebase Admin SDK
7. User auto-created in database if first time
8. Session established ✓

## 🔐 Security Notes

- Service account JSON is **private** - never commit it!
- It's already added to `.gitignore`
- For production, use environment variables (not files)
- Frontend Firebase config is **public** (that's normal)

## 🎯 Features That Work

- ✅ Email/Password sign-up
- ✅ Email/Password sign-in
- ✅ Google OAuth sign-in
- ✅ Sign-out
- ✅ Auto user creation
- ✅ Token refresh
- ✅ Session persistence
- ✅ Backward compatible with Supabase
- ✅ Dev mode with header simulation

## 🐛 Troubleshooting

**App still says "header-sim mode"?**
- Make sure env vars are set
- Restart BOTH servers

**"Firebase not configured" error?**
- Check `FIREBASE_PROJECT_ID` is set
- Check service account JSON path is correct

**Google sign-in popup blocked?**
- Allow popups for localhost
- Or check browser console for errors

**"Invalid token" on backend?**
- Service account might be for wrong project
- Check project IDs match in both configs

## 📚 Resources

- Full setup guide: [FIREBASE_SETUP.md](FIREBASE_SETUP.md)
- Firebase docs: https://firebase.google.com/docs/auth
- Firebase Console: https://console.firebase.google.com/

---

Need help? Check `FIREBASE_SETUP.md` for the complete guide!
