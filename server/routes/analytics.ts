import { Router } from 'express';
import { requireAdmin } from '../middleware/auth';
import { analyticsStore } from '../lib/analytics-store';

const router = Router();

// Get all analytics data in a single request
router.get('/data', requireAdmin, async (req, res) => {
  try {
    const period = req.query.period as string || '24h';
    const [overview, usageData, topUsers, contentStats] = await Promise.all([
      analyticsStore.getOverview(period),
      analyticsStore.getUsageData(period),
      analyticsStore.getTopUsers(),
      analyticsStore.getContentStats()
    ]);

    const analyticsData = {
      overview,
      usageData,
      topUsers,
      contentStats
    };
    
    console.log('Analytics data being sent:', analyticsData);
    res.json(analyticsData);
  } catch (error) {
    console.error('Analytics data error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

export default router;
