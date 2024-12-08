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

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  private async fetchMetrics(period: string = '24h'): Promise<Map<string, number>> {
    const metrics = new Map<string, number>();
    try {
      // Get total users
      const totalUsersResult = await this.pool.query('SELECT COUNT(*) FROM users');
      metrics.set('total_users', parseInt(totalUsersResult.rows[0].count));

      // Get active users (users who logged in within the period)
      const activeUsersResult = await this.pool.query(`
        SELECT COUNT(DISTINCT user_id) 
        FROM user_sessions 
        WHERE created_at >= NOW() - INTERVAL '1 day'
      `);
      metrics.set('active_users', parseInt(activeUsersResult.rows[0].count));

      // Get unique IPs
      const uniqueIpsResult = await this.pool.query(`
        SELECT COUNT(DISTINCT ip_address) 
        FROM user_sessions 
        WHERE created_at >= NOW() - INTERVAL '1 day'
      `);
      metrics.set('unique_ips', parseInt(uniqueIpsResult.rows[0].count));

      // Get flashcard sets count
      const flashcardSetsResult = await this.pool.query('SELECT COUNT(*) FROM flashcard_sets');
      metrics.set('flashcard_sets', parseInt(flashcardSetsResult.rows[0].count));

      // Get memorizations count
      const memorizationsResult = await this.pool.query('SELECT COUNT(*) FROM memorizations');
      metrics.set('memorizations', parseInt(memorizationsResult.rows[0].count));

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