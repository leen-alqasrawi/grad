const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_IaWQ4Cdrt9Pz@ep-delicate-sound-a1f4t8mi-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

// ✅ Health check
app.get('/', (req, res) => {
  res.send('✅ App is running and listening on /');
});

// Get all school names
app.get('/city', (req, res) => {
  pool.query('SELECT "اسم المدرسة" FROM "schooldata";', (error, result) => {
    if (error) {
      console.error('Error occurred:', error);
      return res.status(500).send('Database error');
    }
    res.json(result.rows);
  });
});

// filter values
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

//  Filter schools based on search criteria
app.post('/filter-school', async (req, res) => {
  try {
    const {
      location,
      special_needs,
      language,
      mixed,
      grade
    } = req.body;
    const gradeMap = {
  "1": "الصف الاول",
  "2": "الصف الثاني",
  "3": "الصف الثالث",
  "4": "الصف الرابع",
  "5": "الصف الخامس",
  "6": "الصف السادس",
  "7": "الصف السابع",
  "8": "الصف الثامن",
  "9": "الصف التاسع",
  "10": "الصف العاشر",
  "11": "الصف الأول ثانوي",
  "12": "الصف الثاني ثانوي"
};


    let query = 'SELECT * FROM "schooldata" WHERE 1=1';
    const values = [];
    let count = 1;

    if (location) {
      query += ` AND TRIM("المنطقة") = $${count++}`;
      values.push(location);
    }

    if (special_needs === 'نعم') {
      query += ` AND TRIM("تقبل الطلبة من ذوي الإحتياجات") ILIKE 'نعم%'`;
    } else if (special_needs === 'لا') {
      query += ` AND TRIM("تقبل الطلبة من ذوي الإحتياجات") ILIKE 'لا%'`;
    }

    if (mixed === 'نعم') {
      query += ` AND "مختلطة" ILIKE '%مختلطة%' AND "مختلطة" NOT ILIKE '%غير%'`;
    } else if (mixed === 'لا') {
      query += ` AND (
        "مختلطة" ILIKE '%غير%' OR
        "مختلطة" ILIKE '%ذكور%' OR
        "مختلطة" ILIKE '%إناث%' OR
        "مختلطة" NOT ILIKE '%مختلطة%'
      )`;
    }

    if (language) {
      query += ` AND TRIM("لغة التدريس") = $${count++}`;
      values.push(language);
    }
    if (grade && gradeMap[grade]) {
  query += ` AND "${gradeMap[grade]}"::text ~ '^[0-9]+$' AND "${gradeMap[grade]}"::int > 0`;
}
    const result = await pool.query(query, values);
    console.log("Final SQL Query:", query);
    console.log("SQL Parameters:", values);

    res.json(result.rows);
  } catch (err) {
    console.error('Error filtering schools:', err);
    res.status(500).json({ error: 'Filtering failed' });
  }
});

//  Save filter selection
app.post('/save-form', async (req, res) => {
  const {
    uid, location, special_needs, language, mixed, grade
  } = req.body;

  if (!uid) {
    return res.status(400).json({ error: "firebase error: UID missing" });
  }

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

//  Retrieve previously saved form
app.get('/get-user-form/:uid', async (req, res) => {
  const { uid } = req.params;

  try {
    const result = await pool.query(
      'SELECT location, special_needs, language, mixed, grade_from AS grade FROM user_filters WHERE firebase_uid = $1',
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

// 📘 Get detailed info about a school
app.get('/school-info', async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'Missing school name' });

  try {
    const result = await pool.query(
      'SELECT * FROM "schooldata" WHERE "اسم المدرسة" = $1 LIMIT 1',
      [name]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'School not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching school info:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));