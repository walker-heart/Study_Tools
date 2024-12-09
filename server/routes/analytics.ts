import { asyncHandler } from "../middleware/errorHandling";
import { Router } from 'express';
import { requireAdmin } from './auth';
import { analyticsStore } from '../lib/analytics-store';

const router = Router();

// Get all analytics data in a single request
router.get('/data', requireAdmin, asyncHandler(async (req, res) => {
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
  }
});

export default router;
