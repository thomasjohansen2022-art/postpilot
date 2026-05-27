# PostPilot 🚀
### AI Social Media Post Generator for Local Businesses — $29/month

PostPilot lets local business owners generate a full month of social media posts in 60 seconds using AI. Built with Node.js, Stripe, and OpenAI.

---

## 🛠 Tech Stack
- **Backend:** Node.js + Express
- **Payments:** Stripe Checkout + Billing Portal + Webhooks
- **AI:** OpenAI GPT-4o-mini
- **Auth:** JWT in httpOnly cookies (no database needed)
- **Deploy:** Railway (recommended) or any Node.js host

---

## ⚙️ Setup (Step-by-Step)

### 1. Clone & Install
```bash
npm install
```

### 2. Create a Stripe Account
1. Go to [stripe.com](https://stripe.com) and create an account
2. Get your **Secret Key** from Dashboard → Developers → API Keys
3. Create a **Product**: Dashboard → Products → Add Product
   - Name: "PostPilot Pro"
   - Price: $29.00 / month (recurring)
   - Copy the **Price ID** (starts with `price_`)

### 3. Set Up Stripe Webhook (for production)
1. Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://your-app.up.railway.app/webhook`
3. Events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
4. Copy the **Webhook Signing Secret** (starts with `whsec_`)

### 4. Configure Environment Variables
Copy `.env.example` to `.env` and fill in all values:
```bash
cp .env.example .env
```

```
STRIPE_SECRET_KEY=sk_live_xxx       # Your Stripe secret key
STRIPE_PRICE_ID=price_xxx           # The $29/mo price ID you created
STRIPE_WEBHOOK_SECRET=whsec_xxx     # Webhook signing secret
OPENAI_API_KEY=sk-xxx               # OpenAI API key
JWT_SECRET=any-long-random-string   # Make this up, keep it secret
BASE_URL=https://your-app.railway.app
PORT=3000
```

### 5. Deploy to Railway
1. Push this folder to a GitHub repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add all environment variables in Railway's "Variables" tab
4. Railway auto-detects Node.js and runs `npm start`
5. Copy your Railway URL and set it as `BASE_URL`

### 6. Update Stripe Success URL
In your Stripe Dashboard, make sure the success URL for your price is:
`https://your-app.railway.app/api/success?session_id={CHECKOUT_SESSION_ID}`

(Or just set BASE_URL correctly — the server builds this URL automatically)

---

## 💰 Revenue Model
- **Price:** $29/month per customer
- **10 customers** = $290/month
- **50 customers** = $1,450/month
- **100 customers** = $2,900/month
- **350 customers** = $10,150/month ← the goal

No employees, no inventory, no customer service (Stripe handles billing).

---

## 🗺 API Routes
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/checkout` | Create Stripe Checkout session |
| GET | `/api/success` | Handle post-payment, set auth cookie |
| POST | `/api/login` | Returning user login via email |
| GET | `/api/me` | Get current user info |
| POST | `/api/logout` | Clear auth cookie |
| POST | `/api/portal` | Open Stripe billing portal |
| POST | `/api/generate` | Generate social posts (auth required) |
| POST | `/webhook` | Stripe webhook handler |

---

## 📁 File Structure
```
postpilot/
├── server.js          # Express backend
├── package.json
├── .env.example       # Copy to .env and fill in
├── README.md
└── public/
    ├── index.html     # Landing page (marketing + checkout)
    └── dashboard.html # App dashboard (auth-protected)
```

---

## 🧪 Testing Locally
1. Install [Stripe CLI](https://stripe.com/docs/stripe-cli)
2. Forward webhooks: `stripe listen --forward-to localhost:3000/webhook`
3. Start server: `npm start`
4. Visit: `http://localhost:3000`
5. Use Stripe test card: `4242 4242 4242 4242` (any expiry/CVC)

---

## 📞 Support
Built by PostPilot. For questions, email support@postpilot.app
