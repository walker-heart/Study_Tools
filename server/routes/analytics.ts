import { Router } from 'express';
import { requireAdmin } from './auth';
import pkg from 'pg';
const { Pool } = pkg;

const router = Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface TimeRange {
  startDate: Date;
  endDate: Date;
}

function getTimeRange(period: string): TimeRange {
  const endDate = new Date();
  const startDate = new Date();

  switch (period) {
    case '24h':
      startDate.setHours(startDate.getHours() - 24);
      break;
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    default:
      startDate.setHours(startDate.getHours() - 24); // Default to 24h
  }

  return { startDate, endDate };
}

// Get analytics overview
router.get('/overview', requireAdmin, async (req, res) => {
  try {
    const period = req.query.period as string || '24h';
    const { startDate, endDate } = getTimeRange(period);

    // Get total users
    const totalUsersQuery = await pool.query(
      'SELECT COUNT(*) as total FROM users'
    );

    // Get active users in time range
    const activeUsersQuery = await pool.query(
      'SELECT COUNT(DISTINCT user_id) as active FROM user_sessions WHERE created_at >= $1 AND created_at <= $2',
      [startDate, endDate]
    );

    // Get unique IP addresses
    const uniqueIPsQuery = await pool.query(
      'SELECT COUNT(DISTINCT ip_address) as unique_ips FROM user_sessions WHERE created_at >= $1 AND created_at <= $2',
      [startDate, endDate]
    );

    // Get countries list
    const countriesQuery = await pool.query(
      'SELECT DISTINCT country, COUNT(*) as count FROM user_sessions WHERE created_at >= $1 AND created_at <= $2 GROUP BY country ORDER BY count DESC',
      [startDate, endDate]
    );

    // Previous period comparison for percentage changes
    const prevStartDate = new Date(startDate);
    const prevEndDate = new Date(endDate);
    const timeDiff = endDate.getTime() - startDate.getTime();
    prevStartDate.setTime(prevStartDate.getTime() - timeDiff);
    prevEndDate.setTime(prevEndDate.getTime() - timeDiff);

    const prevActiveUsersQuery = await pool.query(
      'SELECT COUNT(DISTINCT user_id) as active FROM user_sessions WHERE created_at >= $1 AND created_at <= $2',
      [prevStartDate, prevEndDate]
    );

    // Calculate percentage changes
    const currentActive = parseInt(activeUsersQuery.rows[0].active);
    const prevActive = parseInt(prevActiveUsersQuery.rows[0].active);
    const activePercentChange = prevActive === 0 ? 100 : ((currentActive - prevActive) / prevActive) * 100;

    res.json({
      total_users: parseInt(totalUsersQuery.rows[0].total),
      active_users: {
        count: currentActive,
        percent_change: activePercentChange
      },
      unique_ips: {
        count: parseInt(uniqueIPsQuery.rows[0].unique_ips),
      },
      countries: countriesQuery.rows
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics overview' });
  }
});

// Get usage data for charts
router.get('/usage', requireAdmin, async (req, res) => {
  try {
    const period = req.query.period as string || '24h';
    const { startDate, endDate } = getTimeRange(period);

    const usageQuery = await pool.query(
      `SELECT 
        date_trunc('hour', created_at) as hour,
        COUNT(DISTINCT user_id) as active_users
      FROM user_sessions 
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY hour
      ORDER BY hour ASC`,
      [startDate, endDate]
    );

    res.json(usageQuery.rows);
  } catch (error) {
    console.error('Analytics usage error:', error);
    res.status(500).json({ error: 'Failed to fetch usage data' });
  }
});

// Get top active users
router.get('/top-users', requireAdmin, async (req, res) => {
  try {
    const period = req.query.period as string || '24h';
    const { startDate, endDate } = getTimeRange(period);

    const topUsersQuery = await pool.query(
      `SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        COUNT(s.id) as session_count
      FROM users u
      JOIN user_sessions s ON u.id = s.user_id
      WHERE s.created_at >= $1 AND s.created_at <= $2
      GROUP BY u.id, u.first_name, u.last_name, u.email
      ORDER BY session_count DESC
      LIMIT 5`,
      [startDate, endDate]
    );

    res.json(topUsersQuery.rows);
  } catch (error) {
    console.error('Top users error:', error);
    res.status(500).json({ error: 'Failed to fetch top users' });
  }
});

// Get content statistics
router.get('/content-stats', requireAdmin, async (req, res) => {
  try {
    const flashcardsQuery = await pool.query(
      'SELECT COUNT(*) as total FROM flashcard_sets'
    );
    
    const memorizationsQuery = await pool.query(
      'SELECT COUNT(*) as total FROM memorization_sessions'
    );

    res.json({
      total_flashcard_sets: parseInt(flashcardsQuery.rows[0].total),
      total_memorizations: parseInt(memorizationsQuery.rows[0].total)
    });
  } catch (error) {
    console.error('Content stats error:', error);
    res.status(500).json({ error: 'Failed to fetch content statistics' });
  }
});

export default router;
