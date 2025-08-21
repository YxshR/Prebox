# 🎭 Demo Login Credentials

This document contains demo login credentials for testing the Bulk Email Platform with different subscription tiers and verification states.

## 🚀 Quick Setup

1. **Start the backend server:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Start the frontend server:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Seed demo users (run once):**
   ```bash
   cd backend
   npm run seed:demo
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000

## 👥 Demo User Accounts

### 🆓 Free Tier User
- **Email:** `demo@bulkemail.com`
- **Password:** `Demo123!`
- **Features:** 
  - 100 emails/day
  - 300 recipients/month
  - 1 AI template/day
  - Basic analytics
- **Status:** ✅ Email & Phone Verified
- **Use Case:** Testing basic functionality and onboarding

### 📊 Standard Tier User
- **Email:** `standard@bulkemail.com`
- **Password:** `Standard123!`
- **Features:**
  - 1,000 emails/day
  - 5,000 recipients/month
  - 10 AI templates/day
  - Logo customization
- **Status:** ✅ Email & Phone Verified
- **Use Case:** Testing mid-tier features and limits

### 💎 Premium Tier User
- **Email:** `premium@bulkemail.com`
- **Password:** `Premium123!`
- **Features:**
  - 5,000 emails/day
  - 25,000 recipients/month
  - Unlimited AI templates
  - Custom domains (up to 10)
  - Advanced analytics
- **Status:** ✅ Email Verified, ❌ Phone Not Verified
- **Use Case:** Testing premium features and partial verification states

### 🏢 Enterprise Tier User
- **Email:** `enterprise@bulkemail.com`
- **Password:** `Enterprise123!`
- **Features:**
  - Unlimited emails
  - Unlimited recipients
  - Unlimited templates
  - Unlimited custom domains
  - Dedicated support
- **Status:** ✅ Email & Phone Verified
- **Use Case:** Testing enterprise features and unlimited access

### 🆕 New User (Unverified)
- **Email:** `newuser@bulkemail.com`
- **Password:** `NewUser123!`
- **Features:** Free tier limits
- **Status:** ❌ Email & Phone Not Verified
- **Use Case:** Testing onboarding flow and verification process

## 🎯 Testing Scenarios

### 1. **Onboarding Flow**
- Login with `newuser@bulkemail.com` to see the animated onboarding flow
- Experience step-by-step setup process

### 2. **Tier Comparison**
- Login with different tier users to see feature differences
- Test tier-specific UI elements and limitations

### 3. **Email Sending Interface**
- Test progress animations with different usage levels
- See tier-specific limits in action

### 4. **Template Management**
- Compare AI template limits across tiers
- Test hover effects and animations

### 5. **Dashboard Animations**
- Experience smooth transitions and micro-interactions
- Test responsive design across devices

## 🔧 Development Notes

- All demo users have realistic usage data pre-populated
- Email verification can be simulated without actual email sending
- Phone verification uses mock OTP for testing
- Subscription limits are enforced in the UI and backend

## 🛠️ Troubleshooting

### Database Issues
```bash
# Reset and recreate demo users
cd backend
npm run seed:demo
```

### Frontend Issues
```bash
# Clear Next.js cache
cd frontend
rm -rf .next
npm run dev
```

### Backend Issues
```bash
# Check database connection
cd backend
npm run test
```

## 📱 Mobile Testing

All demo accounts work on mobile devices. Test the responsive animations and touch interactions:

- Swipe gestures on template cards
- Touch feedback on buttons
- Mobile-optimized onboarding flow

## 🎨 Animation Features to Test

1. **Loading Animations:** Smooth page transitions
2. **Counter Animations:** Animated statistics and usage meters
3. **Progress Bars:** Email sending progress with smooth animations
4. **Hover Effects:** Interactive template and button hover states
5. **Onboarding Flow:** Step-by-step animated guidance
6. **Floating Actions:** Expandable quick action menu
7. **Background Effects:** Subtle animated gradient orbs

---

**Happy Testing! 🚀**

For any issues or questions, check the console logs or contact the development team.