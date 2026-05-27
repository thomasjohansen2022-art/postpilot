require('dotenv').config();
const express = require('express');
const Stripe = require('stripe');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const OpenAI = require('openai');
const path = require('path');

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Stripe webhook needs raw body — must be before express.json for this route
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send('Webhook Error: ' + err.message);
  }
  // Log events (extend here to handle cancellations, failed payments, etc.)
  console.log('Stripe event:', event.type);
  res.json({ received: true });
});

// Auth middleware
function requireAuth(req, res, next) {
  const token = req.cookies.auth;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

// ── ROUTES ──────────────────────────────────────────────────────────────────

// Start Stripe Checkout
app.post('/api/checkout', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: process.env.BASE_URL + '/api/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: process.env.BASE_URL + '/',
      allow_promotion_codes: true,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err.message);
    res.status(500).json({ error: 'Could not create checkout session.' });
  }
});

// After successful payment — set auth cookie and redirect to dashboard
app.get('/api/success', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
    if (session.payment_status === 'paid') {
      const token = jwt.sign(
        {
          email: session.customer_details.email,
          name: session.customer_details.name,
          customer_id: session.customer,
        },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      res.cookie('auth', token, {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
      });
      res.redirect('/dashboard.html');
    } else {
      res.redirect('/?error=payment_failed');
    }
  } catch (err) {
    console.error('Success error:', err.message);
    res.redirect('/?error=unknown');
  }
});

// Returning user login by email
app.post('/api/login', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const customers = await stripe.customers.list({ email: email.toLowerCase().trim(), limit: 1 });
    if (!customers.data.length) {
      return res.status(404).json({ error: 'No account found with this email.' });
    }

    const customer = customers.data[0];
    const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'active', limit: 1 });
    if (!subs.data.length) {
      return res.status(403).json({ error: 'No active subscription. Please subscribe first.' });
    }

    const token = jwt.sign(
      { email: customer.email, name: customer.name, customer_id: customer.id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.cookie('auth', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
    res.json({ success: true });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Get current user (for dashboard to show name/email)
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ email: req.user.email, name: req.user.name });
});

// Logout
app.post('/api/logout', (req, res) => {
  res.clearCookie('auth');
  res.json({ success: true });
});

// Open Stripe billing portal (manage subscription, cancel, etc.)
app.post('/api/portal', requireAuth, async (req, res) => {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: req.user.customer_id,
      return_url: process.env.BASE_URL + '/dashboard.html',
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: 'Could not open billing portal.' });
  }
});

// Generate social media posts
app.post('/api/generate', requireAuth, async (req, res) => {
  const { businessName, businessType, location, vibe, platform, count, extra } = req.body;

  if (!businessName || !businessType) {
    return res.status(400).json({ error: 'Business name and type are required.' });
  }

  const platformMap = {
    instagram: 'Instagram (use emojis freely, include 6-8 hashtags, visual/lifestyle tone)',
    facebook: 'Facebook (slightly longer, community-focused, start conversations, 3-5 hashtags)',
    twitter: 'Twitter/X (punchy, under 220 characters each, no hashtag overload, 1-2 hashtags max)',
    linkedin: 'LinkedIn (professional tone, value-driven, business achievements, 3-4 hashtags)',
  };

  const selectedPlatform = platformMap[platform] || platformMap.instagram;
  const numPosts = Math.min(parseInt(count) || 10, 20);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert social media manager for local businesses. You write posts that feel authentic, human, and local — never generic or corporate. Every post is ready to copy and publish immediately.',
        },
        {
          role: 'user',
          content: `Write exactly ${numPosts} ${selectedPlatform} posts for this business:

Business Name: ${businessName}
Type of Business: ${businessType}
Location: ${location || 'a local area'}
Tone/Personality: ${vibe || 'Friendly and approachable'}
${extra ? 'Additional notes: ' + extra : ''}

Use a variety of themes across the posts: promotions, behind-the-scenes, product highlights, community love, tips, seasonal moments, engagement questions, customer stories, and calls to action.

Rules:
- Each post is complete and ready to post
- Use emojis naturally throughout
- Add hashtags at the end as specified for the platform
- Separate each post with exactly this on its own line: ---
- Do NOT number posts or add any labels/titles`,
        },
      ],
      max_tokens: 3500,
      temperature: 0.85,
    });

    const raw = completion.choices[0].message.content;
    const posts = raw
      .split(/\n---\n|^---$/m)
      .map((p) => p.trim())
      .filter((p) => p.length > 30);

    res.json({ posts });
  } catch (err) {
    console.error('Generation error:', err.message);
    res.status(500).json({ error: 'Generation failed. Please try again.' });
  }
});

// ── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('PostPilot running on port ' + PORT));
