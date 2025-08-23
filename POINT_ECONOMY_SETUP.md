# Point Economy Setup Guide

This guide will help you set up the complete point economy system for CypherX.

## 🚀 Quick Setup

### Option 1: Automated Setup (Recommended)

**Windows:**
```bash
# Double-click or run:
scripts/setup-point-economy.bat
```

**Mac/Linux:**
```bash
# Make executable and run:
chmod +x scripts/setup-point-economy.sh
./scripts/setup-point-economy.sh
```

### Option 2: Manual Setup

```bash
# Install dependencies
npm install firebase-admin

# Run setup script
node scripts/setup-point-economy.js
```

## 📋 What the Setup Script Does

The setup script automatically:

1. **🔒 Creates Firebase Security Rules**
   - Generates `firestore.rules` file
   - Sets up proper permissions for all collections

2. **🗂️ Creates Required Collections**
   - `pointTransactions` - Track all point earnings/spending
   - `alphaBoosts` - Store alpha boost records
   - `dailyChallenges` - Daily challenges for users
   - `achievements` - Achievement system
   - `pointPools` - Community point pools
   - `userStreaks` - User streak tracking

3. **📊 Sets Up Database Indexes**
   - Creates `firestore.indexes.json` for optimal query performance
   - Configures composite indexes for complex queries

4. **🎯 Initializes Default Data**
   - Creates 5 default achievements
   - Sets up 4 daily challenges
   - Prepares sample data

5. **👥 Updates Existing Users**
   - Adds point economy fields to existing users
   - Sets default values for new fields

6. **⚡ Creates Sample Alpha Boosts**
   - Adds sample alpha boost data for testing

## 🔧 Manual Steps Required

After running the setup script, you need to:

### 1. Deploy Firebase Security Rules

```bash
# Deploy security rules
firebase deploy --only firestore:rules

# Deploy indexes
firebase deploy --only firestore:indexes
```

### 2. Update Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to Firestore Database
4. Verify all collections were created
5. Check that indexes are building (may take a few minutes)

### 3. Test the System

1. Start your development server: `npm run dev`
2. Navigate to the insights page
3. Try using the Alpha Boost feature
4. Check that points are being tracked

## 📁 Generated Files

The setup script creates these files:

- `firestore.rules` - Security rules for Firestore
- `firestore.indexes.json` - Database indexes configuration
- `POINT_ECONOMY_SYSTEM.md` - Complete system documentation

## 🔍 Verification Checklist

After setup, verify:

- [ ] All collections exist in Firebase Console
- [ ] Security rules are deployed
- [ ] Indexes are building/active
- [ ] Alpha Boost component works
- [ ] Point earning/spending works
- [ ] User data is properly updated

## 🐛 Troubleshooting

### Common Issues:

1. **"Permission denied" errors**
   - Ensure Firebase service account has proper permissions
   - Check that `firebaseServiceAccount.json` exists and is valid

2. **Collections not created**
   - Verify Firebase Admin SDK is properly initialized
   - Check network connectivity to Firebase

3. **Indexes not building**
   - Wait a few minutes for indexes to build
   - Check Firebase Console for index status
   - Verify index configuration is correct

4. **Security rules deployment fails**
   - Ensure you have Firebase CLI installed: `npm install -g firebase-tools`
   - Login to Firebase: `firebase login`
   - Check project configuration: `firebase use <project-id>`

### Getting Help:

1. Check the console output for specific error messages
2. Verify your Firebase project configuration
3. Ensure all environment variables are set correctly
4. Check Firebase Console for any error logs

## 🎯 Next Steps

After successful setup:

1. **Integrate Alpha Boost Component**
   - Add to your insights page
   - Test with real articles

2. **Add Point Earning Features**
   - Implement point earning for article interactions
   - Add daily login rewards

3. **Create User Interface**
   - Add point balance display
   - Create transaction history page
   - Build achievement system UI

4. **Test and Monitor**
   - Monitor point economy health
   - Track user engagement
   - Adjust point values as needed

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review Firebase Console logs
3. Verify all setup steps were completed
4. Test with a fresh Firebase project if needed

---

**🎉 Congratulations!** Your point economy system is now ready to use!
