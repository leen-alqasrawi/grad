// server.js
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: 'anasomar12',
    port: 5432,
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

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



app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
