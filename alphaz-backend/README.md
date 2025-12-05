# Alphaz Backend API

Backend API for Alphaz LinkedIn Analytics Platform

## Features

- User management with Clerk authentication
- Supabase database integration
- Webhook handling for Clerk events
- RESTful API endpoints

## Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Environment Configuration:**
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

Required environment variables:
- `PORT` - Server port (default: 5000)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `CLERK_SECRET_KEY` - Clerk secret key from dashboard
- `CLERK_WEBHOOK_SECRET` - Clerk webhook endpoint secret
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins

3. **Run the server:**
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## API Endpoints

### User Management

- `POST /api/users` - Create a new user
- `GET /api/users/:clerkUserId` - Get user by Clerk ID
- `PUT /api/users/:clerkUserId` - Update user
- `GET /api/users/check/exists?email={email}` - Check if user exists

### LinkedIn OAuth

- `GET /api/auth/linkedin/url?clerkUserId={id}` - Get LinkedIn OAuth URL
- `GET /api/auth/linkedin/callback` - Handle OAuth callback
- `GET /api/linkedin/status/:clerkUserId` - Get connection status
- `DELETE /api/linkedin/disconnect/:clerkUserId` - Disconnect LinkedIn
- `GET /api/linkedin/company-pages/:clerkUserId` - Get user's company pages
- `POST /api/linkedin/refresh-token/:clerkUserId` - Check token refresh status

### Webhooks

- `POST /api/webhooks/clerk` - Clerk webhook endpoint

### Health Check

- `GET /api/health` - Server health check

## Database Schema

The backend expects the following Supabase table structure:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  google_id VARCHAR(255) UNIQUE,
  auth_method VARCHAR(50) NOT NULL,
  subscription_status VARCHAR(50) DEFAULT 'trial',
  linkedin_connected BOOLEAN DEFAULT FALSE,
  trial_start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  trial_end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Frontend Integration

To integrate with the frontend:

```javascript
// Create user after Clerk sign-up
const response = await fetch('http://localhost:5000/api/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    clerkUserId: user.id,
    email: user.emailAddresses[0].emailAddress,
    name: user.fullName,
    googleId: user.externalAccounts?.[0]?.providerUserId, // For Google auth
    authMethod: 'gmail' // or 'email'
  })
});

// Get user data
const userData = await fetch(`http://localhost:5000/api/users/${clerkUserId}`);
```

## Webhook Configuration

Configure Clerk webhook endpoint in Clerk Dashboard:
- Endpoint: `https://your-domain.com/api/webhooks/clerk`
- Events to listen:
  - `user.created`
  - `user.updated`  
  - `user.deleted`