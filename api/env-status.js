// Env status diagnostic. Returns whether critical env vars are SET (boolean
// only, values never exposed). Useful for diagnosing "silent failure" bugs
// like the book-webhook AC integration.
//
// Safe to make public: only returns booleans, never key values or partials.

export default function handler(req, res) {
  const check = (name) => ({ set: !!process.env[name], length: process.env[name]?.length || 0 });
  res.status(200).json({
    ranAt: new Date().toISOString(),
    activecampaign: {
      ACTIVECAMPAIGN_API_KEY: check('ACTIVECAMPAIGN_API_KEY'),
      ACTIVECAMPAIGN_API_URL: check('ACTIVECAMPAIGN_API_URL')
    },
    stripe: {
      STRIPE_SECRET_KEY: check('STRIPE_SECRET_KEY'),
      STRIPE_WEBHOOK_SECRET: check('STRIPE_WEBHOOK_SECRET')
    },
    resend: {
      RESEND_API_KEY: check('RESEND_API_KEY')
    },
    admin: {
      CRON_SECRET: check('CRON_SECRET')
    },
    star: {
      STAR_NOTIFY_EMAIL: check('STAR_NOTIFY_EMAIL')
    }
  });
}
