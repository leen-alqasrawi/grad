// server.js
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:anasomar12@localhost:5432/postgres',
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

// ✅ Health check route to confirm app is running
app.get('/', (req, res) => {
  res.send('✅ App is running and listening on /');
});

// Return all school names
app.get('/city', (req, res) => {
  const query = 'SELECT "اسم المدرسة" FROM "schooldata";'; 
  pool.query(query, (error, result) => {
    if (error) {
      console.error('Error occurred:', error);
      res.status(500).send('Database error');
    } else {
      res.json(result.rows);
    }
  });
});

// Return filter options
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
    console.error('Error occurred:', error);
    res.status(500).send('Database error');
  }
});

// Handle filtered search
app.post('/filter-school', async (req, res) => {
  try {
    const {
      location,
      special_needs,
      language,
      mixed,
      grade_from,
      grade_to
    } = req.body;

    let query = 'SELECT * FROM "schooldata" WHERE 1=1';
    const values = [];
    let count = 1;

    if (location) {
      query += ` AND TRIM("المنطقة") = $${count++}`;
      values.push(location);
    }

    if (special_needs === 'نعم') {
      query += ` AND "تقبل الطلبة من ذوي الإحتياجات" ILIKE 'نعم%'`;
    } else if (special_needs === 'لا') {
      query += ` AND "تقبل الطلبة من ذوي الإحتياجات" ILIKE 'لا%'`;
    }

    if (language) {
      query += ` AND TRIM("لغة التدريس") = $${count++}`;
      values.push(language);
    }

    if (mixed === 'نعم') {
      query += ` AND "مختلطة" ILIKE '%مختلطة%'`;
    } else if (mixed === 'لا') {
      query += ` AND ("مختلطة" ILIKE '%غير%' OR "مختلطة" ILIKE '%ذكور%' OR "مختلطة" ILIKE '%إناث%')`;
    }

    // Grade filters can be added here

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Error filtering schools:', err);
    res.status(500).json({ error: 'Filtering failed' });
  }
});

// Save user filters
app.post('/save-form', async (req, res) => {
  const {
    uid, location, special_needs, language, mixed, grade_from, grade_to
  } = req.body;

  if (!uid) {
    return res.status(400).json({ error: "firebase error: UID missing" });
  }

  try {
    await pool.query(
      'INSERT INTO user_filters (firebase_uid, location, special_needs, language, mixed, grade_from, grade_to) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [uid, location, special_needs, language, mixed, grade_from, grade_to]
    );
    res.json({ message: 'school finding data saved into database' });
  } catch (err) {
    console.error('Error saving school finding data:', err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// Retrieve saved form
app.get('/get-user-form/:uid', async (req, res) => {
  const { uid } = req.params;

  try {
    const result = await pool.query(
      'SELECT location, special_needs, language, mixed, grade_from, grade_to FROM user_filters WHERE firebase_uid = $1',
      [uid]
    );

    if (result.rows.length === 0) {
      return res.json({ message: 'No data submitted' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error retrieving user form:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
