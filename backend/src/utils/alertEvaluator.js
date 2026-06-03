const Post = require('../models/Post');
const SentimentAlertRule = require('../models/SentimentAlertRule');
const SentimentAlert = require('../models/SentimentAlert');

// Convert raw score (-1.0 to 1.0) → display score (0–100)
const scoreToDisplay = (rawScore) => (rawScore + 1) * 50;

// Recency weight: weight = 1 / (1 + hoursSincePost * 0.1)
const recencyWeight = (postCreatedAt) => {
  const hoursSince = (Date.now() - new Date(postCreatedAt).getTime()) / (1000 * 60 * 60);
  return 1 / (1 + hoursSince * 0.1);
};

// Compute weighted average display score from an array of posts
const weightedAvg = (posts) => {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const post of posts) {
    const w = recencyWeight(post.createdAt);
    weightedSum += scoreToDisplay(post.sentiment.score) * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
};

const runAlertEvaluator = async () => {
  try {
    // 1. Fetch all active rules
    const rules = await SentimentAlertRule.find({ isActive: true }).lean();

    for (const rule of rules) {
      try {
        const now = new Date();
        const windowMs = rule.comparisonWindowDays * 24 * 60 * 60 * 1000;

        const currentWindowStart = new Date(now.getTime() - windowMs);
        const previousWindowStart = new Date(now.getTime() - 2 * windowMs);

        // Build cohort filter
        const cohortFilter = rule.cohortId ? { 'author.cohortId': rule.cohortId } : {};

        // a. Get current window posts with sentiment
        const currentPosts = await Post.find({
          createdAt: { $gte: currentWindowStart },
          'sentiment.score': { $ne: null },
          isHidden: false,
          ...cohortFilter,
        })
          .select('sentiment createdAt')
          .lean();

        // b. Get previous window posts
        const previousPosts = await Post.find({
          createdAt: { $gte: previousWindowStart, $lt: currentWindowStart },
          'sentiment.score': { $ne: null },
          isHidden: false,
          ...cohortFilter,
        })
          .select('sentiment createdAt')
          .lean();

        // c. Skip if current volume is too low
        if (currentPosts.length < rule.minPostVolume) continue;

        // d. Compute weighted averages
        const currScore = weightedAvg(currentPosts);
        const prevScore = previousPosts.length > 0 ? weightedAvg(previousPosts) : currScore;

        // e. Determine if alert should fire
        let shouldAlert = false;
        let triggerType = 'sentiment_drop';

        if (rule.thresholdType === 'relative') {
          if ((prevScore - currScore) >= rule.thresholdValue) shouldAlert = true;
        } else {
          // absolute
          if (currScore <= rule.thresholdValue) shouldAlert = true;
        }

        // f. Check for duplicate alert in last 48 hours
        if (shouldAlert) {
          const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
          const recentAlert = await SentimentAlert.findOne({
            cohortId: rule.cohortId || null,
            triggerType,
            triggeredAt: { $gte: cutoff48h },
          }).lean();

          if (recentAlert) shouldAlert = false;
        }

        // g. Create alert
        if (shouldAlert) {
          await SentimentAlert.create({
            cohortId: rule.cohortId || null,
            triggerType,
            currentScore: Math.round(currScore * 100) / 100,
            previousScore: Math.round(prevScore * 100) / 100,
            delta: Math.round((prevScore - currScore) * 100) / 100,
            postCount: currentPosts.length,
          });
        }

        // 3. Check for positive spike: currScore > 85 sustained (avg over 3+ days)
        if (currentPosts.length >= rule.minPostVolume) {
          const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
          const recentThreeDayPosts = currentPosts.filter(
            (p) => new Date(p.createdAt) >= threeDaysAgo
          );

          if (recentThreeDayPosts.length > 0) {
            const spikeScore = weightedAvg(recentThreeDayPosts);
            if (spikeScore > 85) {
              // Check duplicate spike alert in last 48 hours
              const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
              const recentSpike = await SentimentAlert.findOne({
                cohortId: rule.cohortId || null,
                triggerType: 'sentiment_spike',
                triggeredAt: { $gte: cutoff48h },
              }).lean();

              if (!recentSpike) {
                await SentimentAlert.create({
                  cohortId: rule.cohortId || null,
                  triggerType: 'sentiment_spike',
                  currentScore: Math.round(spikeScore * 100) / 100,
                  previousScore: Math.round(prevScore * 100) / 100,
                  delta: Math.round((spikeScore - prevScore) * 100) / 100,
                  postCount: recentThreeDayPosts.length,
                });
              }
            }
          }
        }
      } catch (ruleErr) {
        console.error('[alertEvaluator] Error processing rule:', rule._id, ruleErr.message);
      }
    }
  } catch (err) {
    console.error('[alertEvaluator] Error:', err.message);
  }
};

module.exports = { runAlertEvaluator };
