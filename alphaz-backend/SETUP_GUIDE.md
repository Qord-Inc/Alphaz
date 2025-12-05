# Alphaz Backend Setup Guide

## Overview

This backend provides user management for the Alphaz LinkedIn Analytics platform, integrating Clerk authentication with Supabase database storage.

## Complete Setup Process

### 1. Database Setup (Supabase)

1. Create a Supabase account at https://supabase.com
2. Create a new project
3. Go to SQL Editor and run the schema from `alphaz/supabase/schema.sql`
4. Get your credentials from Settings > API:
   - `SUPABASE_URL` - Your project URL
   - `SUPABASE_ANON_KEY` - The anon/public key
   - `SUPABASE_SERVICE_KEY` - The service_role key (keep this secret!)

### 2. Backend Setup

1. **Navigate to backend directory:**
```bash
cd alphaz-backend
```

2. **Create .env file:**
```bash
cp .env.example .env
```

3. **Configure environment variables in .env:**
```env
PORT=5000
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_WEBHOOK_SECRET=your_webhook_secret
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
LINKEDIN_REDIRECT_URI=http://localhost:5000/api/auth/linkedin/callback
FRONTEND_URL=http://localhost:3000
```

4. **Install dependencies:**
```bash
npm install
```

5. **Start the server:**
```bash
npm run dev
```

### 3. Clerk Webhook Configuration

1. Go to Clerk Dashboard > Webhooks
2. Create a new endpoint:
   - URL: `http://localhost:5000/api/webhooks/clerk` (development)
   - For production: `https://your-api-domain.com/api/webhooks/clerk`
3. Subscribe to events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
4. Copy the signing secret to `CLERK_WEBHOOK_SECRET` in .env

### 4. Frontend Integration

The frontend is already configured to:
- Automatically sync users after sign-up/sign-in
- Handle both Gmail and Email authentication methods
- Create user records with trial subscriptions

### 5. Testing the Flow

1. Start the backend server:
```bash
cd alphaz-backend
npm run dev
```

2. Start the frontend in another terminal:
```bash
cd alphaz
npm run dev
```

3. Test sign-up flows:
   - **Email Sign-up**: Go to http://localhost:3000/sign-up
   - **Gmail Sign-up**: Use "Continue with Google" option

4. Verify in Supabase:
   - Check the `users` table for new records
   - Confirm `auth_method` is set correctly
   - Verify trial dates are populated

### 6. API Endpoints Reference

- `POST /api/users` - Create user (called automatically after sign-up)
- `GET /api/users/:clerkUserId` - Get user data
- `PUT /api/users/:clerkUserId` - Update user
- `GET /api/users/check/exists?email={email}` - Check if email exists
- `GET /api/health` - Health check

### 7. Production Deployment

1. **Backend Deployment:**
   - Deploy to services like Heroku, Railway, or AWS
   - Set production environment variables
   - Update `ALLOWED_ORIGINS` for your frontend domain

2. **Update Frontend:**
   - Set `NEXT_PUBLIC_API_URL` to your production API URL
   - Deploy frontend to Vercel or similar

3. **Update Clerk Webhook:**
   - Change webhook URL to production endpoint
   - Ensure HTTPS is used

### Troubleshooting

**User not created after sign-up:**
- Check backend logs for errors
- Verify Clerk webhook is configured correctly
- Ensure environment variables are set

**CORS errors:**
- Add frontend URL to `ALLOWED_ORIGINS` in backend .env
- Restart the backend server

**Database connection issues:**
- Verify Supabase credentials are correct
- Check if Supabase project is active
- Ensure you're using service role key for backend