# PromptRent — LINE Chatbot Backend

> Rental reputation platform for Thailand. Tracks rent payments, builds renter scores.

---

## Quick Start (Local Development)

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
```
Then edit `.env` and fill in:
- `LINE_CHANNEL_ACCESS_TOKEN` — already filled from your LINE OA
- `LINE_CHANNEL_SECRET` — get this from LINE Developers Console
- `DATABASE_URL` — your Supabase PostgreSQL connection string

### 3. Set up database
```bash
npm run db:push        # Push schema to Supabase (first time)
npm run db:generate    # Generate Prisma client
```

### 4. Run locally
```bash
npm run dev            # Uses nodemon for auto-restart
```

### 5. Expose locally with ngrok (for LINE webhook testing)
```bash
# Install ngrok: https://ngrok.com
ngrok http 3000
# Copy the https URL — use it as your LINE webhook URL
```

---

## Deployment (Railway)

### 1. Push code to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/promptrent.git
git push -u origin main
```

### 2. Deploy on Railway
1. Go to [railway.app](https://railway.app)
2. New Project → Deploy from GitHub → select your repo
3. Add environment variables (same as your `.env`)
4. Railway auto-deploys on every push ✅

### 3. Set LINE webhook URL
1. Go to [LINE Developers Console](https://developers.line.biz)
2. Select your channel → Messaging API
3. Webhook URL: `https://your-app.up.railway.app/webhook`
4. Enable webhook → Verify ✅

---

## Project Structure

```
promptrent/
├── src/
│   ├── index.js              # Express server entry point
│   ├── db.js                 # Prisma client singleton
│   ├── lineClient.js         # LINE API client
│   ├── scheduler.js          # Daily cron jobs
│   ├── handlers/
│   │   ├── eventDispatcher.js    # Routes LINE events
│   │   └── conversationRouter.js # Flow state machine
│   ├── flows/
│   │   ├── onboardingFlow.js     # Registration for landlord/tenant
│   │   ├── propertyFlow.js       # Add/manage properties
│   │   ├── leaseFlow.js          # Create leases, invite tenants
│   │   ├── paymentFlow.js        # Payment confirmation
│   │   ├── scoreFlow.js          # View and share renter score
│   │   ├── disputeFlow.js        # Dispute payment records
│   │   └── menuFlow.js           # Navigation menus
│   ├── services/
│   │   ├── userService.js        # User CRUD
│   │   ├── leaseService.js       # Lease management
│   │   ├── paymentService.js     # Payment recording
│   │   ├── scoreService.js       # Score calculation engine
│   │   ├── notificationService.js # Push messages to LINE
│   │   └── eventService.js       # Audit log
│   ├── routes/
│   │   ├── webhook.js            # POST /webhook
│   │   ├── score.js              # GET /score/:token (public)
│   │   └── admin.js              # Admin API
│   └── utils/
│       ├── lineHelpers.js        # Message builders
│       └── stateManager.js       # Conversation state helpers
├── prisma/
│   └── schema.prisma             # Full database schema
├── .env.example
├── .gitignore
└── package.json
```

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API token | `bKDLDT+wv...` |
| `LINE_CHANNEL_SECRET` | LINE channel secret | `abc123...` |
| `DATABASE_URL` | Supabase PostgreSQL URL | `postgresql://postgres:...` |
| `PORT` | Server port | `3000` |
| `APP_BASE_URL` | Your public Railway URL | `https://promptrent.up.railway.app` |
| `ADMIN_SECRET` | Secret for admin API | `your-secret-here` |

---

## How the Chatbot Works

### New User Flow
1. User adds LINE OA → bot asks: "Are you a landlord or tenant?"
2. User selects role → bot collects name + phone
3. User is registered

### Landlord Flow
1. Add property (nickname, address, rent amount, due date)
2. System creates lease with invite token
3. Landlord shares invite token/link with tenant

### Tenant Flow
1. Tenant receives invite → sends `join_[token]` to bot
2. Tenant confirms lease details → lease activates
3. Monthly reminders arrive automatically

### Monthly Cycle (automated)
- **Day due_date - 3**: Tenant receives payment reminder
- **Day due_date**: Landlord receives confirmation request
- **Day due_date + 7**: Follow-up if not confirmed
- **Day due_date + 30**: Auto-mark as missed

### Score Calculation
- Runs after every payment confirmation
- Requires 3+ confirmed months to display
- Formula: Start at 100, deduct for late/missed payments
- Late 1–7 days: -5 | Late 8–30 days: -10 | Late 31+: -20 | Missed: -25

---

## Scoring Rules (V1)

| Payment Status | Days Late | Score Deduction |
|---------------|-----------|-----------------|
| On Time | 0 | 0 |
| Late | 1–7 days | -5 |
| Late | 8–30 days | -10 |
| Late | 31+ days | -20 |
| Missed | N/A | -25 |

| Score | Grade | Label |
|-------|-------|-------|
| 90–100 | A | Excellent |
| 75–89 | B | Good |
| 60–74 | C | Fair |
| 40–59 | D | Needs Improvement |
| 0–39 | E | Poor |

---

## Admin API

All admin endpoints require header: `x-admin-secret: your-secret`

```bash
# Stats
GET /admin/stats

# Open disputes
GET /admin/disputes

# Resolve dispute
PATCH /admin/disputes/:id
Body: { "status": "resolved", "resolutionNote": "Verified payment slip" }

# Recalculate score
POST /admin/scores/recalculate
Body: { "tenantId": "uuid", "leaseId": "uuid" }
```

---

## Testing Checklist

After deployment, test in this order:

```
□ Message your LINE OA → get welcome message with role buttons
□ Select "I'm a Landlord" → enter name and phone
□ Get registered + see landlord main menu
□ Tap "Add Property" → complete property flow
□ See lease created + invite token generated
□ Test tenant flow on a second LINE account
□ Send join_[token] → confirm lease
□ Check Supabase tables: users, properties, leases all have data
□ Trigger scheduler manually to test reminders
□ Confirm a payment → check renter_scores table
```

---

## Next Steps (V2)

- [ ] LINE Rich Menu (persistent bottom menu)
- [ ] Multi-lease tenant score aggregation
- [ ] PromptPay QR payment integration (Omise or 2C2P)
- [ ] Web admin dashboard (Retool or custom)
- [ ] Analytics dashboard (Metabase)
- [ ] Score sharing via LINE share button
- [ ] Landlord can request score from prospective tenant

---

Built with ❤️ for PromptRent
