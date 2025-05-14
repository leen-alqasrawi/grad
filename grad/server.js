const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5500;

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname))); // Serve HTML, CSS, images, etc.

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'anasomar12',
  database: process.env.DB_DATABASE || 'postgres',
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'findschool.html'));
});

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
    res.status(500).json({ error: 'Database error' });  // 👈 valid JSON error
  }
});
app.post('/save-form', async (req, res) => {
  const {
    uid, location, special_needs, language, mixed, grade_from, grade_to
  } = req.body;

  if (!uid) return res.status(400).json({ error: "firebase error: UID missing" });

  try {
    await pool.query(
      `INSERT INTO user_filters (firebase_uid, location, special_needs, language, mixed, grade_from, grade_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [uid, location, special_needs, language, mixed, grade_from, grade_to]
    );
    res.json({ message: 'school finding data saved into database' });
  } catch (err) {
    console.error('error saving school finding data:', err);
    res.status(500).json({ error: 'internal server error' });
  }
});

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

    let query = `SELECT * FROM "schooldata" WHERE 1=1`;
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

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Error filtering schools:', err);
    res.status(500).json({ error: 'Filtering failed' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
