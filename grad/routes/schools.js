const express = require('express');
const router = express.Router();
const { dbPool, redisConnection } = require('../config/database');
const cacheMiddleware = require('../middleware/cache');

// GET /api/schools/city
router.get('/city', cacheMiddleware, async (req, res) => {
  try {
    console.log('Fetching all schools from city endpoint');
    const result = await dbPool.query('SELECT "اسم المدرسة" FROM "schooldata";');
    await redisConnection.set(req.originalUrl, JSON.stringify(result.rows), { EX: 3600 });
    res.json(result.rows);
  } catch (error) {
    console.error('Error occurred in /city endpoint:', error);
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

// GET /api/schools/filters
router.get('/filters', cacheMiddleware, async (req, res) => {
  try {
    console.log('Fetching filter options');
    const locationQuery = `SELECT DISTINCT TRIM("المنطقة") AS "المنطقة" FROM "schooldata" WHERE "المنطقة" IS NOT NULL;`;
    const languageQuery = `SELECT DISTINCT TRIM("لغة التدريس") AS "لغة التدريس" FROM "schooldata" WHERE "لغة التدريس" IS NOT NULL;`;

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
    res.status(500).json({ error: 'Database error', message: error.message });
  }
});

// POST /api/schools/filter
router.post('/filter', async (req, res) => {
  try {
    console.log('Filtering schools with criteria:', req.body);
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

    if (location && location.trim() !== '') {
      query += ` AND TRIM("المنطقة") = $${paramCount++}`;
      parameters.push(location.trim());
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

    if (language && language.trim() !== '') {
      query += ` AND TRIM("لغة التدريس") = $${paramCount++}`;
      parameters.push(language.trim());
    }

    if (grade && gradeMapping[grade]) {
      const gradeColumn = gradeMapping[grade];
      query += ` AND "${gradeColumn}"::text ~ '^[0-9]+$' AND "${gradeColumn}"::int > 0`;
    }

    console.log('Executing query:', query);
    console.log('With parameters:', parameters);

    const result = await dbPool.query(query, parameters);
    
    console.log(`Found ${result.rows.length} schools matching criteria`);
    res.json({
      success: true,
      count: result.rows.length,
      schools: result.rows
    });
  } catch (err) {
    console.error('Error filtering schools:', err);
    res.status(500).json({ 
      error: 'Filtering failed', 
      message: err.message,
      details: err.stack 
    });
  }
});

// GET /api/schools/info
router.get('/info', cacheMiddleware, async (req, res) => {
  const { name } = req.query;
  console.log('Getting school info for:', name);
  
  if (!name) {
    return res.status(400).json({ error: 'Missing school name parameter' });
  }

  try {
    const result = await dbPool.query(
      'SELECT * FROM "schooldata" WHERE "اسم المدرسة" = $1 LIMIT 1',
      [name]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }
    
    await redisConnection.set(req.originalUrl, JSON.stringify(result.rows[0]), { EX: 1800 });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching school info:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// GET /api/schools/student-school
router.get('/student-school', async (req, res) => {
  const { studentId } = req.query;
  console.log('Getting student school info for ID:', studentId);
  
  if (!studentId) {
    return res.status(400).json({ error: 'Missing student ID parameter' });
  }

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
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// GET /api/schools/student-info/:studentId
router.get('/student-info/:studentId', async (req, res) => {
  const { studentId } = req.params;
  console.log('Getting detailed student info for ID:', studentId);
  
  if (!studentId) {
    return res.status(400).json({ error: 'Missing student ID parameter' });
  }

  try {
    const studentQuery = `
      SELECT 
        s.id,
        s.student_id,
        s.name as student_name,
        s.parent_name,
        s.parent_email,
        s.grade,
        s.home_address,
        s.school_name,
        s.school_id,
        s.home_lat,
        s.home_lng,
        sd."اسم المدرسة" as arabic_school_name,
        sd."المنطقة" as school_area
      FROM students s
      LEFT JOIN "schooldata" sd ON s.school_id = sd.school_id
      WHERE (s.student_id = $1 OR s.id = $1) AND (s.is_active IS NULL OR s.is_active = true)
      LIMIT 1
    `;
    
    const result = await dbPool.query(studentQuery, [studentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Student not found or inactive',
        message: 'Please check your Student ID or contact the school administration'
      });
    }

    const student = result.rows[0];
    
    const responseData = {
      student: {
        id: student.student_id || student.id,
        name: student.student_name,
        grade: student.grade,
        parentName: student.parent_name,
        parentEmail: student.parent_email
      },
      school: {
        name: student.school_name,
        arabicName: student.arabic_school_name,
        area: student.school_area,
        school_id: student.school_id
      },
      home: {
        address: student.home_address,
        coordinates: student.home_lat && student.home_lng ? {
          lat: parseFloat(student.home_lat),
          lng: parseFloat(student.home_lng)
        } : null
      }
    };

    res.json(responseData);

  } catch (err) {
    console.error('Error fetching student info for tracking:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Unable to fetch student information. Please try again later.'
    });
  }
});

module.exports = router;