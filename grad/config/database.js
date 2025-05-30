const { Pool } = require("pg");
const { createClient } = require("redis");

const isProduction = process.env.NODE_ENV === 'production';

const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_IaWQ4Cdrt9Pz@ep-delicate-sound-a1f4t8mi-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

const redisConnection = createClient({
  username: 'default',
  password: 'LXra3VRCTOSFh9tvQBMLFfLZC4BhiqG1',
  socket: {
    host: 'redis-16198.c99.us-east-1-4.ec2.redns.redis-cloud.com',
    port: 16198
  }
});

redisConnection.on('error', err => console.error('Redis Client Error', err));

(async () => {
  await redisConnection.connect();
  console.log('Redis connected successfully');
})();

module.exports = { dbPool, redisConnection };