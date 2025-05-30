const express = require('express');
const router = express.Router();
const { dbPool, redisConnection } = require('../config/database');
const cacheMiddleware = require('../middleware/cache');

// GET /api/schools/city
router.get('/city', cacheMiddleware, async (req, res) => {
  try {
    const result = await dbPool.query('SELECT "اسم المدرسة" FROM "schooldata";');
    await redisConnection.set(req.originalUrl, JSON.stringify(result.rows), { EX: 3600 });
    res.json(result.rows);
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).send('Database error');
  }
});

// GET /api/schools/filters
router.get('/filters', cacheMiddleware, async (req, res) => {
  try {
    const locationQuery = `SELECT DISTINCT TRIM("المنطقة") AS "المنطقة" FROM "schooldata";`;
    const languageQuery = `SELECT DISTINCT TRIM("لغة التدريس") AS "لغة التدريس" FROM "schooldata";`;

    const locationResult = await dbPool.query(locationQuery);
    const languageResult = await dbPool.query(languageQuery);

    const responseData = {
      location: locationResult.rows.map(r => r["المنطقة"]).filter(Boolean),
      language: languageResult.rows.map(r => r["لغة التدريس"]).filter(Boolean),
    };

    await redisConnection.set(req.originalUrl, JSON.stringify(responseData), { EX: 3600 });
    res.json(responseData);
  } catch (error) {
    console.error('Error loading filters:', error);
    res.status(500).send('Database error');
  }
});

// POST /api/schools/filter
router.post('/filter', async (req, res) => {
  try {
    const { location, special_needs, language, mixed, grade } = req.body;
    
    const gradeMapping = {
      "1": "الصف الاول", "2": "الصف الثاني", "3": "الصف الثالث",
      "4": "الصف الرابع", "5": "الصف الخامس", "6": "الصف السادس",
      "7": "الصف السابع", "8": "الصف الثامن", "9": "الصف التاسع",
      "10": "الصف العاشر", "11": "الصف الأول ثانوي", "12": "الصف الثاني ثانوي"
    };

    let query = 'SELECT * FROM "schooldata" WHERE 1=1';
    const parameters = [];
    let paramCount = 1;

    if (location) {
      query += ` AND TRIM("المنطقة") = $${paramCount++}`;
      parameters.push(location);
    }
    
    if (special_needs === 'نعم') {
      query += ` AND TRIM("تقبل الطلبة من ذوي الإحتياجات") ILIKE 'نعم%'`;
    } else if (special_needs === 'لا') {
      query += ` AND TRIM("تقبل الطلبة من ذوي الإحتياجات") ILIKE 'لا%'`;
    }

    if (mixed === 'نعم') {
      query += ` AND "مختلطة" ILIKE '%مختلطة%' AND "مختلطة" NOT ILIKE '%غير%'`;
    } else if (mixed === 'لا') {
      query += ` AND ("مختلطة" ILIKE '%غير%' OR "مختلطة" ILIKE '%ذكور%' OR "مختلطة" ILIKE '%إناث%')`;
    }

    if (language) {
      query += ` AND TRIM("لغة التدريس") = $${paramCount++}`;
      parameters.push(language);
    }

    if (grade && gradeMapping[grade]) {
      const gradeColumn = gradeMapping[grade];
      query += ` AND "${gradeColumn}"::text ~ '^[0-9]+$' AND "${gradeColumn}"::int > 0`;
    }

    const result = await dbPool.query(query, parameters);
    res.json(result.rows);
  } catch (err) {
    console.error('Error filtering schools:', err);
    res.status(500).json({ error: 'Filtering failed' });
  }
});

// GET /api/schools/info
router.get('/info', cacheMiddleware, async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'Missing school name' });

  try {
    const result = await dbPool.query(
      'SELECT * FROM "schooldata" WHERE "اسم المدرسة" = $1 LIMIT 1',
      [name]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    
    await redisConnection.set(req.originalUrl, JSON.stringify(result.rows[0]), { EX: 1800 });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching school info:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/schools/student-school
router.get('/student-school', async (req, res) => {
  const { studentId } = req.query;
  if (!studentId) return res.status(400).json({ error: 'Missing student ID' });

  try {
    const studentQuery = `
      SELECT st.home_lat, st.home_lng, s.school_id, s."اسم المدرسة", s."المنطقة"
      FROM students AS st
      JOIN schooldata AS s ON st.school_id = s.school_id
      WHERE st.id = $1 LIMIT 1
    `;
    
    const result = await dbPool.query(studentQuery, [studentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found or no linked school' });
    }

    const row = result.rows[0];
    const responseData = {
      school: {
        name: row["اسم المدرسة"],
        region: row["المنطقة"],
        school_id: row.school_id
      },
      home: { lat: row.home_lat, lng: row.home_lng }
    };
    res.json(responseData);
  } catch (err) {
    console.error('Error fetching school for student:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;