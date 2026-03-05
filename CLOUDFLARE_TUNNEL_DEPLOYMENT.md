# Cloudflare Tunnel Deployment Guide

This guide explains how to deploy your Space Case Cruises app via a Cloudflare Tunnel on your Synology NAS to fix CORS, Firebase authentication, and image loading issues.

## Overview

When accessing the app via a public HTTPS domain (e.g., `https://yourdomain.com`), you need to:
1. Configure CORS to allow your public domain
2. Set the correct API URL for the frontend
3. Configure Firebase to allow your domain for authentication

---

## Step 1: Configure Environment Variables

### Backend Configuration

Edit your `.env` file in the project root:

```bash
# Add your public domain to CORS allowed origins
CORS_ALLOWED_ORIGINS=https://yourdomain.com

# Optional: Include multiple domains (separated by commas)
# CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Set Node environment to production for additional security
NODE_ENV=production

# Enable rate limiting in production
ENABLE_RATE_LIMIT=true

# Firebase backend configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT=./dist/firebase-service-account.json
```

### Frontend Configuration

Edit your `ui/.env` file:

```bash
# Option 1: Use same-origin (recommended when UI and API are on same domain)
VITE_API_BASE_URL=

# Option 2: Or explicitly set your domain
# VITE_API_BASE_URL=https://yourdomain.com

# Firebase frontend configuration
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

---

## Step 2: Configure Firebase Authorized Domains

Firebase restricts authentication redirects to authorized domains only.

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Authentication** → **Settings** → **Authorized domains**
4. Click **Add domain**
5. Add your Cloudflare Tunnel domain: `yourdomain.com`
6. Save changes

**Note:** Firebase automatically includes:
- `localhost` (for local development)
- `*.firebaseapp.com` (Firebase hosting)

---

## Step 3: Update docker-compose.yml for Production

Update your `docker-compose.yml` to use the environment variables:

```yaml
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "${API_PORT:-4000}:4000"
    env_file: .env
    environment:
      HOST: 0.0.0.0
      PORT: 4000
      # Use the CORS_ALLOWED_ORIGINS from .env
      CORS_ALLOWED_ORIGINS: ${CORS_ALLOWED_ORIGINS}
    volumes:
      - ./uploads:/app/uploads
      - ./backups:/app/backups
      - ./firebase-service-account.json:/app/firebase-service-account.json

  ui:
    build:
      context: ui
      dockerfile: ../Dockerfile.ui
      args:
        # Leave empty to use same origin
        VITE_API_BASE_URL: ${VITE_API_BASE_URL:-}
        VITE_FIREBASE_API_KEY: ${VITE_FIREBASE_API_KEY}
        VITE_FIREBASE_AUTH_DOMAIN: ${VITE_FIREBASE_AUTH_DOMAIN}
        VITE_FIREBASE_PROJECT_ID: ${VITE_FIREBASE_PROJECT_ID}
        VITE_FIREBASE_STORAGE_BUCKET: ${VITE_FIREBASE_STORAGE_BUCKET}
        VITE_FIREBASE_MESSAGING_SENDER_ID: ${VITE_FIREBASE_MESSAGING_SENDER_ID}
        VITE_FIREBASE_APP_ID: ${VITE_FIREBASE_APP_ID}
    ports:
      - "${UI_PORT:-8080}:80"
```

---

## Step 4: Configure Cloudflare Tunnel

### Nginx Reverse Proxy Setup (on Synology NAS)

If you're using nginx to route traffic to both UI and API containers, configure it like this:

```nginx
server {
    listen 80;
    server_name localhost;

    # Serve UI (frontend)
    location / {
        proxy_pass http://ui:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Serve API (backend)
    location /api/ {
        proxy_pass http://api:4000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Serve uploads (static files)
    location /uploads/ {
        proxy_pass http://api:4000/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Cloudflare Tunnel Configuration

Your `cloudflared` config should point to the nginx container:

```yaml
tunnel: your-tunnel-id
credentials-file: /path/to/credentials.json

ingress:
  - hostname: yourdomain.com
    service: http://nginx:80
  - service: http_status:404
```

---

## Step 5: Rebuild and Deploy

1. **Stop existing containers:**
   ```bash
   docker compose down
   ```

2. **Rebuild with new environment variables:**
   ```bash
   docker compose build --no-cache
   ```

3. **Start the services:**
   ```bash
   docker compose up -d
   ```

4. **Verify the services are running:**
   ```bash
   docker compose ps
   docker compose logs -f
   ```

---

## Step 6: Verify the Deployment

1. **Check CORS Headers:**
   ```bash
   curl -I -X OPTIONS https://yourdomain.com/api/v1/health \
     -H "Origin: https://yourdomain.com" \
     -H "Access-Control-Request-Method: GET"
   ```
   
   You should see:
   ```
   Access-Control-Allow-Origin: https://yourdomain.com
   Access-Control-Allow-Credentials: true
   ```

2. **Check Image Loading:**
   - Open your site: `https://yourdomain.com`
   - Open browser Developer Tools → Network tab
   - Verify images load from `https://yourdomain.com/uploads/...`
   - Ensure there are no "Mixed Content" warnings

3. **Test Firebase Authentication:**
   - Try logging in with Google/Email
   - Check browser console for any Firebase errors
   - Verify the redirect URL uses `https://yourdomain.com`

---

## Troubleshooting

### Issue: CORS Error
**Error:** `Access to fetch at 'https://yourdomain.com/api/v1/...' from origin 'https://yourdomain.com' has been blocked by CORS policy`

**Solution:**
- Verify `CORS_ALLOWED_ORIGINS=https://yourdomain.com` is set in backend `.env`
- Rebuild the API container: `docker compose up -d --build api`
- Check backend logs: `docker compose logs api`

### Issue: Mixed Content Warning
**Error:** `Mixed Content: The page at 'https://yourdomain.com' was loaded over HTTPS, but requested an insecure resource 'http://...'`

**Solution:**
- Verify `VITE_API_BASE_URL` is empty or set to `https://yourdomain.com` in `ui/.env`
- Rebuild the UI container: `docker compose up -d --build ui`

### Issue: Firebase Authentication Fails
**Error:** `auth/unauthorized-domain`

**Solution:**
- Add `yourdomain.com` to Firebase Console → Authentication → Authorized domains
- Ensure `VITE_FIREBASE_AUTH_DOMAIN` matches your Firebase project

### Issue: Images Don't Load
**Error:** 404 on `/uploads/...` paths

**Solution:**
- Verify nginx routes `/uploads/` to `http://api:4000/uploads/`
- Check that uploads volume is mounted: `docker compose logs api | grep uploads`
- Ensure Cloudflare Tunnel forwards all paths to nginx

---

## Security Checklist

- [ ] `NODE_ENV=production` is set
- [ ] `CORS_ALLOWED_ORIGINS` includes **only** your domain (not `*`)
- [ ] `ALLOW_HEADER_AUTH=false` in production
- [ ] `ENABLE_RATE_LIMIT=true` is set
- [ ] Firebase authorized domains configured
- [ ] HTTPS is enforced by Cloudflare
- [ ] Sensitive `.env` files are not committed to git

---

## Quick Reference

| Environment Variable | Location | Purpose |
|---------------------|----------|---------|
| `CORS_ALLOWED_ORIGINS` | Backend `.env` | Allow frontend domain for API calls |
| `VITE_API_BASE_URL` | Frontend `ui/.env` | Set API endpoint (empty = same origin) |
| `VITE_FIREBASE_*` | Frontend `ui/.env` | Firebase configuration |
| `FIREBASE_PROJECT_ID` | Backend `.env` | Firebase admin SDK |

---

## Additional Resources

- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Firebase Authorized Domains](https://firebase.google.com/docs/auth/web/redirect-best-practices)
- [CORS Best Practices](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
