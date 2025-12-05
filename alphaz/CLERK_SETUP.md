# Clerk Authentication Setup Guide

## Overview
This project uses Clerk for authentication. Follow these steps to complete the setup.

## Setup Instructions

### 1. Create a Clerk Account
1. Go to [https://clerk.com](https://clerk.com)
2. Sign up for a free account
3. Create a new application

### 2. Get Your API Keys
1. In your Clerk Dashboard, navigate to your application
2. Go to "API Keys" in the sidebar
3. Copy your keys:
   - **Publishable Key** (starts with `pk_`)
   - **Secret Key** (starts with `sk_`)

### 3. Update Environment Variables
Open `.env.local` and replace the placeholder values with your actual keys:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_actual_key_here
CLERK_SECRET_KEY=sk_test_your_actual_key_here
```

### 4. Configure Clerk Settings (Optional)
In your Clerk Dashboard:
1. **User & Authentication** → **Email, Phone, Username**
   - Configure how users can sign in
2. **User & Authentication** → **Social Connections**
   - Enable Google, LinkedIn, etc.
3. **Customization** → **Branding**
   - Customize the appearance

### 5. Run the Application
```bash
npm run dev
```

## Features Implemented

✅ **Authentication Flow**
- Sign in page at `/sign-in`
- Sign up page at `/sign-up`
- Protected routes (dashboard, monitor, create, plan)
- Public routes (sign-in, sign-up)

✅ **User Profile**
- User avatar in sidebar
- Display user name/email
- Sign out functionality

✅ **Middleware Protection**
- Automatic redirect to sign-in for unauthenticated users
- Configurable public/private routes

✅ **Styled Components**
- Orange-themed authentication forms
- Consistent with app design system

## Customization

### Changing Protected Routes
Edit `middleware.ts` to modify which routes require authentication:

```typescript
export default authMiddleware({
  publicRoutes: ["/sign-in", "/sign-up", "/landing"], // Add more public routes
});
```

### Styling Authentication Pages
The sign-in/sign-up pages use Clerk's appearance prop. Modify in:
- `/app/sign-in/[[...sign-in]]/page.tsx`
- `/app/sign-up/[[...sign-up]]/page.tsx`

## Troubleshooting

**"Invalid API Key" Error**
- Double-check your keys in `.env.local`
- Ensure no extra spaces or quotes
- Restart the development server

**Redirect Issues**
- Check `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` in `.env.local`
- Verify middleware configuration

**Styling Not Applied**
- Clear browser cache
- Check for conflicting CSS classes