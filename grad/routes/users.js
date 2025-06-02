const express = require('express');
const router = express.Router();
const { dbPool } = require('../config/database');

// POST /api/users/save-form
router.post('/save-form', async (req, res) => {
  const { uid, location, special_needs, language, mixed, grade } = req.body;

  if (!uid) return res.status(400).json({ error: "firebase error: UID missing" });

  try {
    const insertQuery = 'INSERT INTO user_filters (firebase_uid, location, special_needs, language, mixed, grade_from) VALUES ($1, $2, $3, $4, $5, $6)';
    await dbPool.query(insertQuery, [uid, location, special_needs, language, mixed, grade]);
    res.json({ message: 'school finding data saved into database' });
  } catch (err) {
    console.error('Error saving school finding data:', err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// GET /api/users/form/:uid
router.get('/form/:uid', async (req, res) => {
  const { uid } = req.params;

  try {
    const selectQuery = `SELECT location, special_needs, language, mixed, grade_from as grade
       FROM user_filters WHERE firebase_uid = $1 ORDER BY created_at DESC LIMIT 1`;
    
    const result = await dbPool.query(selectQuery, [uid]);

    if (result.rows.length === 0) return res.json({ message: 'No data submitted' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error retrieving user form:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/update-location
router.post('/update-location', async (req, res) => {
  console.log('Update location request received');
  console.log('Request body:', req.body);
  
  const { uid, lat, lng } = req.body;

  if (!uid) {
    return res.status(400).json({ 
      success: false, 
      error: 'User ID is required' 
    });
  }

  if (!lat || !lng) {
    return res.status(400).json({ 
      success: false, 
      error: 'Latitude and longitude are required' 
    });
  }

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid coordinates' 
    });
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ 
      success: false, 
      error: 'Coordinates out of valid range' 
    });
  }

  try {
    console.log('Updating location for user:', uid);
    console.log('New coordinates:', lat, lng);

    // Check if student record exists with this firebase_uid
    const checkResult = await dbPool.query(
      'SELECT id, student_id, name, parent_name FROM students WHERE firebase_uid = $1 AND (is_active IS NULL OR is_active = true)',
      [uid]
    );

    if (checkResult.rows.length === 0) {
      console.log('No student record found for Firebase UID:', uid);
      
      return res.status(404).json({
        success: false,
        error: 'Student profile not found',
        details: 'You need to select a school first to create your student profile.',
        suggestion: 'Please go to "Find School" → select a school → get your Student ID, then try updating location again.',
        action: 'redirect_to_school_search'
      });
    }

    const student = checkResult.rows[0];
    console.log('Found student record:', student);

    // Update the location
    const updateResult = await dbPool.query(
      'UPDATE students SET home_lat = $1, home_lng = $2, updated_at = CURRENT_TIMESTAMP WHERE firebase_uid = $3',
      [parseFloat(lat), parseFloat(lng), uid]
    );

    console.log('Update result:', updateResult.rowCount, 'rows affected');

    if (updateResult.rowCount === 0) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update location in database',
        details: 'Update query executed but no rows were affected'
      });
    }

    res.json({
      success: true,
      message: 'Home location updated successfully',
      coordinates: { 
        lat: parseFloat(lat), 
        lng: parseFloat(lng) 
      },
      studentInfo: {
        id: student.id,
        studentId: student.student_id,
        name: student.name,
        parentName: student.parent_name
      },
      timestamp: new Date().toISOString(),
      rowsUpdated: updateResult.rowCount
    });

  } catch (error) {
    console.error('Error updating location:');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    console.error('Detail:', error.detail);
    console.error('Stack:', error.stack);
    
    // Handle specific PostgreSQL errors
    let errorMessage = 'Database error while updating location';
    if (error.code === '23505') {
      errorMessage = 'Duplicate entry error';
    } else if (error.code === '23503') {
      errorMessage = 'Foreign key constraint error';
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: {
        message: error.message,
        code: error.code
      }
    });
  }
});

// GET /api/users/location/:uid
router.get('/location/:uid', async (req, res) => {
  const { uid } = req.params;

  if (!uid) {
    return res.status(400).json({ 
      success: false, 
      error: 'User ID is required' 
    });
  }

  try {
    const result = await dbPool.query(
      'SELECT name, home_lat, home_lng, school_id FROM students WHERE firebase_uid = $1 LIMIT 1',
      [uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No student profile found for this user'
      });
    }

    const userData = result.rows[0];
    
    res.json({
      success: true,
      student: {
        name: userData.name,
        homeLocation: {
          lat: userData.home_lat,
          lng: userData.home_lng
        },
        schoolId: userData.school_id
      }
    });

  } catch (error) {
    console.error('Error fetching user location:', error);
    res.status(500).json({
      success: false,
      error: 'Database error while fetching location'
    });
  }
});

// GET /api/users/check-student/:uid
router.get('/check-student/:uid', async (req, res) => {
  const { uid } = req.params;

  try {
    const result = await dbPool.query(
      'SELECT id, name, firebase_uid, school_id FROM students WHERE firebase_uid = $1',
      [uid]
    );

    res.json({
      success: true,
      exists: result.rows.length > 0,
      student: result.rows[0] || null
    });

  } catch (error) {
    console.error('Error checking student:', error);
    res.status(500).json({
      success: false,
      error: 'Database error'
    });
  }
});

module.exports = router;