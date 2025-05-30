const { redisConnection } = require('../config/database');

const cacheMiddleware = async (req, res, next) => {
  const cacheKey = req.originalUrl;
  try {
    const cachedData = await redisConnection.get(cacheKey);
    if (cachedData) {
      console.log('Cache hit for ' + cacheKey);
      return res.json(JSON.parse(cachedData));
    }
    next();
  } catch (err) {
    console.error('Cache error:', err);
    next();
  }
};

module.exports = cacheMiddleware;