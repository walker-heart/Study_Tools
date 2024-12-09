export async function testDatabaseConnection(sql: any) {
  try {
    const result = await sql`SELECT NOW()`;
    console.log('Database connection successful:', result[0].now);
    return true;
  } catch (error) {
    console.error('Database Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });

    throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
