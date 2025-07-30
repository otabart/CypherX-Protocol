# Alchemy API Setup Guide

## Overview
The wallet explorer component uses Alchemy's API to fetch blockchain data. Currently, the app is running with mock data for testing purposes.

## Setup Instructions

### 1. Get Alchemy API Key
1. Go to [Alchemy](https://www.alchemy.com/)
2. Create an account or sign in
3. Create a new app for Base Mainnet
4. Copy your API key

### 2. Configure Environment Variables
Create a `.env.local` file in your project root with:

```env
# Alchemy API Configuration
NEXT_PUBLIC_ALCHEMY_API_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY_HERE

# Firebase Configuration (if not already configured)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 3. Enable Real Data
Once you have your Alchemy API key configured:

1. Open `app/explorer/address/[walletAddress]/page.tsx`
2. Find the section with mock data (around line 200)
3. Comment out the mock data section
4. Uncomment the Alchemy API calls section

### 4. Test
1. Restart your development server
2. Navigate to `/explorer/address/0x742d35cc6634c0532925a3b8d4c9db96c4b4d8b6`
3. You should see real blockchain data

## Current Status
- ✅ UI/UX enhancements complete
- ✅ Mock data working for testing
- ⏳ Real Alchemy integration (requires API key)
- ✅ Error handling and debugging added

## Features Working
- Wallet metrics display
- Token holdings table
- Transaction history
- Search and filtering
- Export functionality
- Responsive design
- Animations and transitions 