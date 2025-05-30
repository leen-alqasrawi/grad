const express = require('express');
const router = express.Router();
const { dbPool } = require('../config/database');

// POST /api/reviews/submit
router.post('/submit', async (req, res) => {
  try {
    const { reviewerName, reviewMessage, rating, firebaseUid } = req.body;

    if (!reviewerName || !reviewMessage) {
      return res.status(400).json({ error: 'Name and message are required' });
    }

    if (reviewerName.trim().length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters' });
    }

    if (reviewMessage.trim().length < 10) {
      return res.status(400).json({ error: 'Review message must be at least 10 characters' });
    }

    const ratingValue = rating ? parseInt(rating) : null;
    if (ratingValue && (ratingValue < 1 || ratingValue > 5)) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const queryText = `INSERT INTO reviews (reviewer_name, review_message, rating, firebase_uid) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, reviewer_name, review_message, rating, created_at`;
    
    const result = await dbPool.query(
      queryText,
      [reviewerName.trim(), reviewMessage.trim(), ratingValue, firebaseUid || null]
    );

    console.log('Review saved successfully:', result.rows[0]);

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully!',
      review: result.rows[0]
    });

  } catch (err) {
    console.error('Error saving review:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to submit review. Please try again.' 
    });
  }
});

// GET /api/reviews
router.get('/', async (req, res) => {
  try {
    const pageNum = parseInt(req.query.page) || 1;
    const limitNum = parseInt(req.query.limit) || 10;
    const offsetNum = (pageNum - 1) * limitNum;

    console.log('GET /reviews called with:', { page: pageNum, limit: limitNum, offset: offsetNum });

    const reviewQuery = `SELECT id, reviewer_name, review_message, rating, created_at 
                   FROM reviews 
                   ORDER BY created_at DESC 
                   LIMIT $1 OFFSET $2`;
    
    console.log('Executing query:', reviewQuery);
    console.log('With parameters:', [limitNum, offsetNum]);

    const queryResult = await dbPool.query(reviewQuery, [limitNum, offsetNum]);
    
    console.log('Query result:', {
      rowCount: queryResult.rowCount,
      rows: queryResult.rows
    });

    const countResult = await dbPool.query('SELECT COUNT(*) FROM reviews');
    const totalReviews = parseInt(countResult.rows[0].count);
    
    console.log('Total reviews in database:', totalReviews);

    const totalPages = Math.ceil(totalReviews / limitNum);

    const responseData = {
      reviews: queryResult.rows,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages,
        totalReviews: totalReviews,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    };

    console.log('Sending response:', responseData);

    res.json(responseData);

  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

module.exports = router;