# Admin Setup Guide

## 🎯 Overview
This guide helps you set up your admin account with maximum stats and configure the referral system.

## 📋 Prerequisites
- Firebase service account key (`firebaseServiceAccount.json`)
- Your admin wallet address

## 🚀 Setup Steps

### 1. Update Admin Wallet Address
Edit `scripts/setup-admin.js` and replace `YOUR_ADMIN_WALLET_ADDRESS_HERE` with your actual wallet address.

### 2. Run Admin Setup
```bash
node scripts/setup-admin.js
```

### 3. Verify Setup
```bash
node scripts/test-admin.js
```

## 📊 Admin Account Features

### Max Stats:
- **Points**: 50,000
- **Tier**: Diamond
- **Badges**: All 15 badges
- **Volume**: $1,000,000
- **Swaps**: 1,000
- **Referral Code**: ADMIN
- **Referral Count**: 100
- **Referral Earnings**: 50,000 points

### Badges Included:
- first_swap
- volume_trader
- whale_trader
- daily_user
- weekly_user
- power_user
- content_creator
- popular_author
- viral_author
- event_organizer
- community_leader
- influencer
- early_adopter
- beta_tester
- bug_hunter

## 🔗 Referral System

### How It Works:
1. **Referral Code Generation**: Users get unique 6-character codes
2. **Signup Bonus**: 100 points for referrer, 50 points for new user
3. **Volume Bonus**: 1% of swap volume goes to referrer
4. **Tracking**: All referral activities are logged

### API Endpoints:
- `GET /api/referral?walletAddress=...` - Generate referral code
- `POST /api/referral` - Use referral code or earn volume bonus

## 🎨 UI Features

### Enhanced UserProfileDropdown:
- **Tier Display**: Color-coded tier indicator
- **Progress Bar**: Shows progress to next tier
- **Badge Preview**: Shows up to 3 earned badges
- **Referral Stats**: Shows referral count and earnings
- **Points Display**: Formatted with commas

### Removed Features:
- Full profile page (deleted)
- "View Full Profile" link removed

## 🔧 Troubleshooting

### Common Issues:
1. **Admin not found**: Run setup script again
2. **UI not updating**: Check browser console for errors
3. **Referral not working**: Verify API endpoints are accessible

### Debug Commands:
```bash
# Check admin status
node scripts/test-admin.js

# Reset admin (if needed)
node scripts/setup-admin.js
```

## 📝 Notes
- Admin account gets all badges automatically
- Referral system is integrated with swap points
- UI changes are immediate after setup
- All referral activities are tracked in user_activities collection 