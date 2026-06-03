require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const FAQ  = require('../models/FAQ');
const faqJson = require('../../../faq.json');

const ACCOUNTS = [
  { username: 'admin',      email: 'admin@vins.in',  password: 'Admin@123456',  role: 'admin' },
  { username: 'vinsintern', email: 'intern@vins.in', password: 'Intern@123456', role: 'user'  },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[seed] Connected to MongoDB\n');

    // ── Users ────────────────────────────────────────────────────────
    for (const account of ACCOUNTS) {
      const existing = await User.findOne({ email: account.email });
      if (existing) { console.log(`[seed] Already exists: ${account.email} (skipped)`); continue; }
      const created = await User.create(account);
      console.log(`[seed] Created ${account.role}: ${account.email}  (id: ${created._id})`);
    }

    // ── FAQ ──────────────────────────────────────────────────────────
    const faqCount   = await FAQ.countDocuments();
    // Consider stale if no document has at least one question
    const hasQuestions = faqCount > 0 &&
      (await FAQ.findOne({ 'sub.0': { $exists: true } })) !== null;

    if (faqCount === 0 || !hasQuestions) {
      if (faqCount > 0) {
        await FAQ.deleteMany({});
        console.log(`\n[seed] Cleared ${faqCount} FAQ docs with no questions`);
      }
      const docs = faqJson.faq.map((section, i) => ({ main: section.main, sub: section.sub, order: i }));
      await FAQ.insertMany(docs);
      console.log(`[seed] Inserted ${docs.length} FAQ categories from faq.json`);
    } else {
      console.log(`\n[seed] FAQ already seeded (${faqCount} categories with questions, skipped)`);
    }

    process.exit(0);
  } catch (err) {
    console.error('[seed] Error:', err.message);
    process.exit(1);
  }
};

seed();
