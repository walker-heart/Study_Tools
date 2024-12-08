import { EventEmitter } from 'events';

interface AnalyticsData {
  totalUsers: number;
  activeUsers: Map<string, Set<number>>;  // period -> set of user IDs
  countries: Map<string, number>;  // country -> count
  ipAddresses: Set<string>;
  userSessions: Map<number, number>;  // userId -> session count
  flashcardSets: number;
  memorizations: number;
}

class AnalyticsStore extends EventEmitter {
  private data: AnalyticsData;
  
  constructor() {
    super();
    this.data = {
      totalUsers: 0,
      activeUsers: new Map(),
      countries: new Map(),
      ipAddresses: new Set(),
      userSessions: new Map(),
      flashcardSets: 0,
      memorizations: 0
    };
    
    // Initialize with some sample data
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Set total users
    this.data.totalUsers = 50;

    // Set active users for different periods
    const periods = ['24h', '7d', '30d'];
    periods.forEach(period => {
      const userSet = new Set<number>();
      // Add some random user IDs
      for (let i = 1; i <= 20; i++) {
        userSet.add(i);
      }
      this.data.activeUsers.set(period, userSet);
    });

    // Set country data
    this.data.countries.set('United States', 25);
    this.data.countries.set('United Kingdom', 10);
    this.data.countries.set('Canada', 8);
    this.data.countries.set('Australia', 7);

    // Set IP addresses
    for (let i = 1; i <= 30; i++) {
      this.data.ipAddresses.add(`192.168.1.${i}`);
    }

    // Set user sessions
    for (let i = 1; i <= 5; i++) {
      this.data.userSessions.set(i, Math.floor(Math.random() * 50) + 1);
    }

    // Set content stats
    this.data.flashcardSets = 25;
    this.data.memorizations = 150;
  }

  getOverview(period: string = '24h') {
    const activeUsers = this.data.activeUsers.get(period)?.size || 0;
    const prevPeriodActive = Math.floor(activeUsers * 0.8); // Simulate previous period
    const percentChange = ((activeUsers - prevPeriodActive) / prevPeriodActive) * 100;

    return {
      total_users: this.data.totalUsers,
      active_users: {
        count: activeUsers,
        percent_change: Math.round(percentChange * 10) / 10
      },
      unique_ips: {
        count: this.data.ipAddresses.size,
      },
      countries: Array.from(this.data.countries.entries()).map(([country, count]) => ({
        country,
        count
      }))
    };
  }

  getUsageData(period: string = '24h') {
    // Generate mock usage data for the chart
    const hours = period === '24h' ? 24 : period === '7d' ? 168 : 720;
    const data = [];
    
    for (let i = 0; i < hours; i++) {
      const date = new Date();
      date.setHours(date.getHours() - (hours - i));
      data.push({
        hour: date.toISOString(),
        active_users: Math.floor(Math.random() * 20) + 1
      });
    }
    
    return data;
  }

  getTopUsers() {
    return Array.from(this.data.userSessions.entries())
      .map(([userId, count]) => ({
        id: userId,
        first_name: `User`,
        last_name: `${userId}`,
        email: `user${userId}@example.com`,
        session_count: count
      }))
      .sort((a, b) => b.session_count - a.session_count)
      .slice(0, 5);
  }

  getContentStats() {
    return {
      total_flashcard_sets: this.data.flashcardSets,
      total_memorizations: this.data.memorizations
    };
  }
}

export const analyticsStore = new AnalyticsStore();
