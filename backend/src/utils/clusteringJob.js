const DeadEndSearch = require('../models/DeadEndSearch');
const SearchCluster = require('../models/SearchCluster');
const { openrouterRequest } = require('./openrouter');

const runClusteringJob = async () => {
  try {
    // 1. Fetch up to 100 unprocessed DeadEndSearch documents
    const unprocessed = await DeadEndSearch.find({ clusterId: null })
      .sort({ createdAt: 1 })
      .limit(100)
      .lean();

    // 2. Return early if fewer than 3
    if (unprocessed.length < 3) return;

    // 3. Build query list
    const queries = unprocessed.map((d) => d.normalizedQuery);

    // 4. Call openrouterRequest for clustering
    const userContent =
      'Group these search queries by the topic or information need they represent.\n' +
      'Return ONLY valid JSON array, no other text:\n' +
      '[ { "cluster_label": "<human-readable topic>", "queries": ["query1", "query2"] } ]\n' +
      "Queries that don't fit any meaningful cluster should go in a cluster labeled 'Miscellaneous'.\n" +
      'QUERIES:\n' +
      queries.join('\n');

    const response = await openrouterRequest(
      [
        {
          role: 'system',
          content: 'You are a query clustering engine for an internship FAQ system.',
        },
        { role: 'user', content: userContent },
      ],
      'anthropic/claude-3-haiku',
      { maxTokens: 1024, temperature: 0.2 }
    );

    // 5. Parse JSON response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return;
    const clusters = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(clusters)) return;

    // 6. Process each cluster
    for (const cluster of clusters) {
      const clusterLabel = cluster.cluster_label;
      const clusterQueries = cluster.queries;
      if (!clusterLabel || !Array.isArray(clusterQueries) || clusterQueries.length === 0) continue;

      // a. Find or create SearchCluster (case-insensitive label match)
      let existing = await SearchCluster.findOne({
        label: { $regex: `^${clusterLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      });

      const newCount = clusterQueries.length;
      const oldCount = existing ? existing.queryCount : 0;

      // b. Determine trend
      let trend = 'flat';
      if (newCount > oldCount) trend = 'up';
      else if (newCount < oldCount) trend = 'down';

      if (existing) {
        existing.queryCount += newCount;
        existing.lastSeen = new Date();
        existing.lastClusteredAt = new Date();
        existing.trend = trend;
        await existing.save();
      } else {
        existing = await SearchCluster.create({
          label: clusterLabel,
          queryCount: newCount,
          firstSeen: new Date(),
          lastSeen: new Date(),
          lastClusteredAt: new Date(),
          trend,
        });
      }

      // c. For each query string, find matching DeadEndSearch and set clusterId
      for (const q of clusterQueries) {
        const match = unprocessed.find((d) => d.normalizedQuery === q);
        if (match) {
          await DeadEndSearch.findByIdAndUpdate(match._id, { $set: { clusterId: existing._id } });
        }
      }
    }
  } catch (err) {
    console.error('[clusteringJob] Error:', err.message);
  }
};

module.exports = { runClusteringJob };
