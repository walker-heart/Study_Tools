import { Router } from 'express';
import { requireAdmin } from './auth';
import { analyticsStore } from '../lib/analytics-store';

const router = Router();

// Get all analytics data in a single request
router.get('/data', requireAdmin, (req, res) => {
  try {
    const period = req.query.period as string || '24h';
    const analyticsData = {
      overview: analyticsStore.getOverview(period),
      usageData: analyticsStore.getUsageData(period),
      topUsers: analyticsStore.getTopUsers(),
      contentStats: analyticsStore.getContentStats()
    };
    
    console.log('Analytics data being sent:', analyticsData);
    res.json(analyticsData);
  } catch (error) {
    console.error('Analytics data error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

export default router;