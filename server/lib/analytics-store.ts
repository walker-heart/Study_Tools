import { randomInt } from 'crypto';
import pkg from 'pg';
const { Pool } = pkg;

// Type definitions
interface AnalyticsMetric {
  metric_name: string;
  metric_value: number;
  period: string;
}

interface CountryData {
  country: string;
  count: number;
}

interface TopUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  session_count: number;
}

interface UsageDataPoint {
  hour: string;
  active_users: number;
}

interface AnalyticsOverview {
  total_users: number;
  active_users: {
    count: number;
    percent_change: number;
  };
  unique_ips: {
    count: number;
  };
  countries: CountryData[];
}

class AnalyticsStore {
  private pool: any;
  private currentUser: { id: number } | null = null;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Test database connection
    this.pool.query('SELECT NOW()', (err: Error) => {
      if (err) {
        console.error('Database connection error:', err);
      } else {
        console.log('Database connection successful');
      }
    });
  }

  setCurrentUser(user: { id: number }) {
    this.currentUser = user;
  }

  private async fetchMetrics(period: string = '24h'): Promise<Map<string, number>> {
    const metrics = new Map<string, number>();
    try {
      // Get total users
      const totalUsersResult = await this.pool.query('SELECT COUNT(*) as count FROM users WHERE is_active = true');
      console.log('Total users result:', totalUsersResult.rows[0]);
      metrics.set('total_users', parseInt(totalUsersResult.rows[0].count) || 0);

      // Get active users (users who have logged in)
      const activeUsersResult = await this.pool.query(`
        SELECT COUNT(DISTINCT u.id) as count
        FROM users u
        WHERE u.is_active = true
        AND EXISTS (
          SELECT 1 FROM user_sessions s 
          WHERE s.user_id = u.id 
          AND s.created_at >= NOW() - INTERVAL '1 day'
        )
      `);
      console.log('Active users result:', activeUsersResult.rows[0]);
      metrics.set('active_users', parseInt(activeUsersResult.rows[0].count) || 0);

      // Insert a session record for currently logged-in user if they don't have one
      if (this.currentUser?.id) {
        await this.pool.query(`
          INSERT INTO user_sessions (user_id, created_at)
          SELECT $1, CURRENT_TIMESTAMP
          WHERE NOT EXISTS (
            SELECT 1 FROM user_sessions 
            WHERE user_id = $1 
            AND created_at >= NOW() - INTERVAL '1 day'
          )
        `, [this.currentUser.id]);
      }

      // Get unique IPs (defaulting to active users count if IP tracking is not implemented)
      metrics.set('unique_ips', metrics.get('active_users') || 0);

      // Get flashcard sets count
      const flashcardSetsResult = await this.pool.query(`
        SELECT COUNT(*) as count 
        FROM flashcard_sets 
        WHERE created_at >= NOW() - INTERVAL '1 day'
      `);
      console.log('Flashcard sets result:', flashcardSetsResult.rows[0]);
      metrics.set('flashcard_sets', parseInt(flashcardSetsResult.rows[0].count) || 0);

      // Get memorizations count
      const memorizationsResult = await this.pool.query(`
        SELECT COUNT(*) as count 
        FROM memorizations 
        WHERE completed_at >= NOW() - INTERVAL '1 day'
      `);
      console.log('Memorizations result:', memorizationsResult.rows[0]);
      metrics.set('memorizations', parseInt(memorizationsResult.rows[0].count) || 0);

      console.log('Final metrics:', Object.fromEntries(metrics));
      return metrics;
    } catch (error) {
      console.error('Error fetching metrics:', error);
      return new Map();
    }
  }

  private async fetchUsageData(period: string = '24h'): Promise<UsageDataPoint[]> {
    try {
      const result = await this.pool.query(`
        SELECT 
          date_trunc('hour', created_at) as hour,
          COUNT(DISTINCT user_id) as active_users
        FROM user_sessions
        WHERE created_at >= NOW() - INTERVAL '1 day'
        GROUP BY hour
        ORDER BY hour
      `);
      
      return result.rows.map(row => ({
        hour: row.hour.toISOString(),
        active_users: parseInt(row.active_users)
      }));
    } catch (error) {
      console.error('Error fetching usage data:', error);
      return [];
    }
  }

  private async fetchTopUsers(): Promise<TopUser[]> {
    try {
      const result = await this.pool.query(`
        SELECT 
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          COUNT(s.id) as session_count
        FROM users u
        LEFT JOIN user_sessions s ON s.user_id = u.id
        GROUP BY u.id, u.first_name, u.last_name, u.email
        ORDER BY session_count DESC
        LIMIT 5
      `);
      
      return result.rows.map(row => ({
        id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        session_count: parseInt(row.session_count)
      }));
    } catch (error) {
      console.error('Error fetching top users:', error);
      return [];
    }
  }

  async getOverview(period: string = '24h'): Promise<AnalyticsOverview> {
    const metrics = await this.fetchMetrics(period);
    return {
      total_users: metrics.get('total_users') || 0,
      active_users: {
        count: metrics.get('active_users') || 0,
        percent_change: 0 // To be calculated based on previous period
      },
      unique_ips: {
        count: metrics.get('unique_ips') || 0,
      },
      countries: [] // To be implemented with actual country data
    };
  }

  async getUsageData(period: string = '24h'): Promise<UsageDataPoint[]> {
    return this.fetchUsageData(period);
  }

  async getTopUsers(): Promise<TopUser[]> {
    return this.fetchTopUsers();
  }

  async getContentStats(): Promise<{ total_flashcard_sets: number; total_memorizations: number }> {
    const metrics = await this.fetchMetrics();
    return {
      total_flashcard_sets: metrics.get('flashcard_sets') || 0,
      total_memorizations: metrics.get('memorizations') || 0
    };
  }
}

export const analyticsStore = new AnalyticsStore();