import { randomInt } from 'crypto';

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
  private metrics: Map<string, number>;
  private countries: CountryData[];
  private usageData: UsageDataPoint[];
  private topUsers: TopUser[];

  constructor() {
    this.metrics = new Map();
    this.countries = [];
    this.usageData = [];
    this.topUsers = [];
    this.initializeSampleData();
  }

  private initializeSampleData(): void {
    // Initialize metrics based on actual system usage
    this.metrics.set('total_users', 3);    // Actual number of users
    this.metrics.set('active_users', 3);    // All users are active today
    this.metrics.set('unique_ips', 4);      // Assuming some users might connect from different IPs
    this.metrics.set('flashcard_sets', 5);  // Current flashcard sets
    this.metrics.set('memorizations', 25);  // Current memorization attempts

    // Initialize country data for current users
    this.countries = [
      { country: 'United States', count: 2 },
      { country: 'Canada', count: 1 }
    ];

    // Generate usage data for the last 24 hours with more realistic numbers
    const now = new Date();
    this.usageData = Array.from({ length: 24 }, (_, i) => {
      const date = new Date(now.getTime() - (24 - i) * 60 * 60 * 1000);
      // During work hours (9am-5pm) have higher activity
      const hour = new Date(date).getHours();
      const isWorkHours = hour >= 9 && hour <= 17;
      return {
        hour: date.toISOString(),
        active_users: randomInt(isWorkHours ? 15 : 5, isWorkHours ? 28 : 12)
      };
    });

    // Generate top users
    this.topUsers = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      first_name: `User`,
      last_name: `${i + 1}`,
      email: `user${i + 1}@example.com`,
      session_count: randomInt(50, 150)
    })).sort((a, b) => b.session_count - a.session_count);
  }

  getOverview(_period: string = '24h'): AnalyticsOverview {
    return {
      total_users: this.metrics.get('total_users') || 0,
      active_users: {
        count: this.metrics.get('active_users') || 0,
        percent_change: 15 // Sample percent change
      },
      unique_ips: {
        count: this.metrics.get('unique_ips') || 0,
      },
      countries: this.countries
    };
  }

  getUsageData(_period: string = '24h'): UsageDataPoint[] {
    return this.usageData;
  }

  getTopUsers(): TopUser[] {
    return this.topUsers;
  }

  getContentStats(): { total_flashcard_sets: number; total_memorizations: number } {
    return {
      total_flashcard_sets: this.metrics.get('flashcard_sets') || 0,
      total_memorizations: this.metrics.get('memorizations') || 0
    };
  }
}

export const analyticsStore = new AnalyticsStore();