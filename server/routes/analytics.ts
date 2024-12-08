import { Router } from 'express';
import { requireAdmin } from './auth';
import { analyticsStore } from '../lib/analytics-store';

const router = Router();

// Get analytics overview
router.get('/overview', requireAdmin, (req, res) => {
  try {
    const period = req.query.period as string || '24h';
    const overview = analyticsStore.getOverview(period);
    res.json(overview);
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics overview' });
  }
});

// Get usage data for charts
router.get('/usage', requireAdmin, (req, res) => {
  try {
    const period = req.query.period as string || '24h';
    const usageData = analyticsStore.getUsageData(period);
    res.json(usageData);
  } catch (error) {
    console.error('Analytics usage error:', error);
    res.status(500).json({ error: 'Failed to fetch usage data' });
  }
});

// Get top active users
router.get('/top-users', requireAdmin, (req, res) => {
  try {
    const topUsers = analyticsStore.getTopUsers();
    res.json(topUsers);
  } catch (error) {
    console.error('Top users error:', error);
    res.status(500).json({ error: 'Failed to fetch top users' });
  }
});

// Get content statistics
router.get('/content-stats', requireAdmin, (req, res) => {
  try {
    const contentStats = analyticsStore.getContentStats();
    res.json(contentStats);
  } catch (error) {
    console.error('Content stats error:', error);
    res.status(500).json({ error: 'Failed to fetch content statistics' });
  }
});

export default router;
