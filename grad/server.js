const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const { createClient } = require("redis");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

// PostgreSQL setup
const isProduction = process.env.NODE_ENV === 'production';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_IaWQ4Cdrt9Pz@ep-delicate-sound-a1f4t8mi-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

// Redis setup
const client = createClient({
  username: 'default',
  password: 'LXra3VRCTOSFh9tvQBMLFfLZC4BhiqG1',
  socket: {
    host: 'redis-16198.c99.us-east-1-4.ec2.redns.redis-cloud.com',
    port: 16198
  }
});

client.on('error', err => console.error('❌ Redis Client Error', err));

(async () => {
  await client.connect();
  console.log('✅ Redis connected');
})();

// ✅ Health check
app.get('/', (req, res) => {
  res.send('✅ App is running and listening on /');
});

// 🎓 Get all school names
app.get('/city', (req, res) => {
  pool.query('SELECT "اسم المدرسة" FROM "schooldata";', (error, result) => {
    if (error) {
      console.error('Error occurred:', error);
      return res.status(500).send('Database error');
    }
    res.json(result.rows);
  });
});

// 🎯 Get filter values
app.get('/filters', async (req, res) => {
  try {
    const queries = {
      location: `SELECT DISTINCT TRIM("المنطقة") AS "المنطقة" FROM "schooldata";`,
      language: `SELECT DISTINCT TRIM("لغة التدريس") AS "لغة التدريس" FROM "schooldata";`,
      mixed: `
        SELECT DISTINCT 
          CASE 
            WHEN "مختلطة" ILIKE '%مختلطة%' THEN 'نعم'
            WHEN "مختلطة" ILIKE '%غير%' OR "مختلطة" ILIKE '%ذكور%' OR "مختلطة" ILIKE '%إناث%' THEN 'لا'
            ELSE NULL
          END AS "mixed_flag"
        FROM "schooldata"
        WHERE "مختلطة" IS NOT NULL;
      `,
      special_needs: `
        SELECT DISTINCT 
          CASE 
            WHEN "تقبل الطلبة من ذوي الإحتياجات" ILIKE 'لا' THEN 'لا'
            WHEN "تقبل الطلبة من ذوي الإحتياجات" IS NULL THEN NULL
            ELSE 'نعم'
          END AS "needs_flag"
        FROM "schooldata"
        WHERE "تقبل الطلبة من ذوي الإحتياجات" IS NOT NULL;
      `
    };

    const [location, language, mixed, special_needs] = await Promise.all([
      pool.query(queries.location),
      pool.query(queries.language),
      pool.query(queries.mixed),
      pool.query(queries.special_needs),
    ]);

    res.json({
      location: location.rows.map(r => r["المنطقة"]),
      language: language.rows.map(r => r["لغة التدريس"]),
      mixed: mixed.rows.map(r => r["mixed_flag"]),
      special_needs: special_needs.rows.map(r => r["needs_flag"]),
    });
  } catch (error) {
    console.error('Error loading filters:', error);
    res.status(500).send('Database error');
  }
});

// 🎯 Filter schools
app.post('/filter-school', async (req, res) => {
  try {
    const { location, special_needs, language, mixed, grade } = req.body;
    const gradeMap = {
      "1": "الصف الاول", "2": "الصف الثاني", "3": "الصف الثالث",
      "4": "الصف الرابع", "5": "الصف الخامس", "6": "الصف السادس",
      "7": "الصف السابع", "8": "الصف الثامن", "9": "الصف التاسع",
      "10": "الصف العاشر", "11": "الصف الأول ثانوي", "12": "الصف الثاني ثانوي"
    };

    let query = 'SELECT * FROM "schooldata" WHERE 1=1';
    const values = [];
    let count = 1;

    if (location) {
      query += ` AND TRIM("المنطقة") = $${count++}`;
      values.push(location);
    }
    if (special_needs === 'نعم') query += ` AND TRIM("تقبل الطلبة من ذوي الإحتياجات") ILIKE 'نعم%'`;
    else if (special_needs === 'لا') query += ` AND TRIM("تقبل الطلبة من ذوي الإحتياجات") ILIKE 'لا%'`;

    if (mixed === 'نعم') {
      query += ` AND "مختلطة" ILIKE '%مختلطة%' AND "مختلطة" NOT ILIKE '%غير%'`;
    } else if (mixed === 'لا') {
      query += ` AND ("مختلطة" ILIKE '%غير%' OR "مختلطة" ILIKE '%ذكور%' OR "مختلطة" ILIKE '%إناث%')`;
    }

    if (language) {
      query += ` AND TRIM("لغة التدريس") = $${count++}`;
      values.push(language);
    }

    if (grade && gradeMap[grade]) {
      query += ` AND "${gradeMap[grade]}"::text ~ '^[0-9]+$' AND "${gradeMap[grade]}"::int > 0`;
    }

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Error filtering schools:', err);
    res.status(500).json({ error: 'Filtering failed' });
  }
});

// 💾 Save form submission
app.post('/save-form', async (req, res) => {
  const { uid, location, special_needs, language, mixed, grade} = req.body;

  if (!uid) return res.status(400).json({ error: "firebase error: UID missing" });

  try {
    await pool.query(
      'INSERT INTO user_filters (firebase_uid, location, special_needs, language, mixed, grade_from) VALUES ($1, $2, $3, $4, $5, $6)',
      [uid, location, special_needs, language, mixed, grade]
    );
    res.json({ message: 'school finding data saved into database' });
  } catch (err) {
    console.error('Error saving school finding data:', err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// 🔍 Get previously saved user form
app.get('/get-user-form/:uid', async (req, res) => {
  const { uid } = req.params;

  try {
    const result = await pool.query(
  `SELECT location, special_needs, language, mixed, grade_from, grade_to
   FROM user_filters
   WHERE firebase_uid = $1
   ORDER BY created_at DESC
   LIMIT 1`,
  [uid]
);

    if (result.rows.length === 0) return res.json({ message: 'No data submitted' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error retrieving user form:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//  Get detailed info about a school
app.get('/school-info', async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'Missing school name' });

  try {
    const result = await pool.query(
      'SELECT * FROM "schooldata" WHERE "اسم المدرسة" = $1 LIMIT 1',
      [name]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching school info:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
  console.log(`📡 Sending driver location for ${schoolId}`, latitude, longitude);

});

//  Track driver's bus location
app.post('/track/driver', async (req, res) => {
  const { schoolId, lat, lng } = req.body;
  if (!schoolId || !lat || !lng) return res.status(400).send("Missing fields");

  await client.set(`bus:${schoolId}`, JSON.stringify({ lat, lng, timestamp: Date.now() }));
  res.send("Bus location updated");
});

//  Get bus location for a school
app.get('/track/:schoolId', async (req, res) => {
  const { schoolId } = req.params;
  const data = await client.get(`bus:${schoolId}`);
  if (!data) return res.status(404).send('No location available');
  res.json(JSON.parse(data));
});
// 📘 Get school info by student ID
app.get('/get-student-school', async (req, res) => {
  const { studentId } = req.query;
  if (!studentId) return res.status(400).json({ error: 'Missing student ID' });

  try {
    const result = await pool.query(`
      SELECT st.home_lat, st.home_lng, s.school_id,
             s."اسم المدرسة", s."المنطقة"
      FROM students AS st
      JOIN schooldata AS s ON st.school_id = s.school_id
      WHERE st.id = $1
      LIMIT 1
    `, [studentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found or no linked school' });
    }

    const row = result.rows[0];

    res.json({
      school: {
        name: row["اسم المدرسة"],
        region: row["المنطقة"],
        school_id: row.school_id
      },
      home: {
        lat: row.home_lat,
        lng: row.home_lng
      }
    });
  } catch (err) {
    console.error('Error fetching school for student:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.post('/update-location', async (req, res) => {
  const { uid, lat, lng } = req.body;
  if (!uid || !lat || !lng) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    const existing = await pool.query(
      'SELECT 1 FROM students WHERE firebase_uid = $1 LIMIT 1',
      [uid]
    );

    if (existing.rows.length === 0) {
      // Try to find user's selected location from user_filters
      let school_id = 'SCH001'; // fallback default

      const schoolResult = await pool.query(
        `SELECT location FROM user_filters
         WHERE firebase_uid = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [uid]
      );

      if (schoolResult.rows.length > 0) {
        const location = schoolResult.rows[0].location;

        const match = await pool.query(
          `SELECT school_id FROM schooldata
           WHERE TRIM("المنطقة") = $1
           LIMIT 1`,
          [location]
        );

        if (match.rows.length > 0) {
          school_id = match.rows[0].school_id;
        }
      }

      await pool.query(
        `INSERT INTO students (id, name, firebase_uid, school_id, home_lat, home_lng)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          'stu_' + Date.now(),
          'Anonymous',
          uid,
          school_id,
          lat,
          lng
        ]
      );
    } else {
      await pool.query(
        `UPDATE students
         SET home_lat = $1, home_lng = $2
         WHERE firebase_uid = $3`,
        [lat, lng, uid]
      );
    }

    res.json({ message: 'Location updated successfully' });
  } catch (err) {
    console.error('Error updating location:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});





//  Start server
app.listen(PORT, () => console.log(` Server running on port ${PORT}`));
