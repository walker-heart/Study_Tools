interface Environment {
  NODE_ENV: 'development' | 'production';
  APP_URL: string;
  PORT: number;
}

export const env: Environment = {
  NODE_ENV: (process.env.NODE_ENV as 'development' | 'production') || 'development',
  APP_URL: process.env.APP_URL || 'http://localhost:5000',
  PORT: parseInt(process.env.PORT || '5000', 10)
};
