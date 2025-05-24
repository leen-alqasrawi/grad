// ====================================================================================================
// DEPENDENCIES AND IMPORTS
// ====================================================================================================
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const { createClient } = require("redis");
const vision = require('@google-cloud/vision');
const path = require('path');
const fs = require('fs');
const { Resend } = require('resend');

// ====================================================================================================
// SERVER CONFIGURATION
// ====================================================================================================
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

// ====================================================================================================
// DATABASE SETUP (POSTGRESQL)
// ====================================================================================================
const isProduction = process.env.NODE_ENV === 'production';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_IaWQ4Cdrt9Pz@ep-delicate-sound-a1f4t8mi-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

// ====================================================================================================
// REDIS CACHE SETUP
// ====================================================================================================
const redisClient = createClient({
  username: 'default',
  password: 'LXra3VRCTOSFh9tvQBMLFfLZC4BhiqG1',
  socket: {
    host: 'redis-16198.c99.us-east-1-4.ec2.redns.redis-cloud.com',
    port: 16198
  }
});

redisClient.on('error', err => console.error('❌ Redis Client Error', err));

(async () => {
  await redisClient.connect();
  console.log('✅ Redis connected');
})();

// Cache middleware
const cacheMiddleware = async (req, res, next) => {
  const cacheKey = req.originalUrl;
  try {
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      console.log(`Cache hit for ${cacheKey}`);
      return res.json(JSON.parse(cachedData));
    }
    next();
  } catch (err) {
    console.error('Cache error:', err);
    next();
  }
};

// ====================================================================================================
// GOOGLE CLOUD VISION API SETUP
// ====================================================================================================
let visionClient = null;
let visionEnabled = false;

function initializeVisionClient() {
  try {
    const keyfilePath = path.join(__dirname, './keyfile.json');

    if (fs.existsSync(keyfilePath)) {
      const credentials = JSON.parse(fs.readFileSync(keyfilePath, 'utf8'));
      
      if (!credentials.private_key || !credentials.client_email) {
        console.error('ERROR: Missing required credentials in keyfile');
        return false;
      }

      visionClient = new vision.ImageAnnotatorClient({
        credentials: {
          private_key: credentials.private_key,
          client_email: credentials.client_email,
        },
        projectId: credentials.project_id,
      });
      console.log('✅ Google Cloud Vision initialized with keyfile');
      return true;
    }
    
    // Environment variable fallbacks
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      visionClient = new vision.ImageAnnotatorClient();
      console.log('✅ Google Cloud Vision initialized with environment credentials');
      return true;
    }
    
    console.warn('⚠️ No valid Vision API credentials found');
    return false;
    
  } catch (error) {
    console.error('❌ Vision API initialization failed:', error.message);
    return false;
  }
}

visionEnabled = initializeVisionClient();

// ====================================================================================================
// EMAIL SERVICE SETUP
// ====================================================================================================
const resend = new Resend('re_FAA82UX5_LGeKKY9kC8sAk6iVTPfbNuFc');

// ====================================================================================================
// BASIC ROUTES
// ====================================================================================================
// Health check
app.get('/', (req, res) => {
  res.send('✅ App is running and listening on /');
});

// Get all school names
app.get('/city', cacheMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT "اسم المدرسة" FROM "schooldata";');
    await redisClient.set(req.originalUrl, JSON.stringify(result.rows), { EX: 3600 });
    res.json(result.rows);
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).send('Database error');
  }
});

// ====================================================================================================
// SCHOOL FILTERING AND SEARCH ROUTES
// ====================================================================================================
// Get filter values for dropdowns
app.get('/filters', cacheMiddleware, async (req, res) => {
  try {
    const queries = {
      location: `SELECT DISTINCT TRIM("المنطقة") AS "المنطقة" FROM "schooldata";`,
      language: `SELECT DISTINCT TRIM("لغة التدريس") AS "لغة التدريس" FROM "schooldata";`,
    };

    const [location, language] = await Promise.all([
      pool.query(queries.location),
      pool.query(queries.language),
    ]);

    const responseData = {
      location: location.rows.map(r => r["المنطقة"]).filter(Boolean),
      language: language.rows.map(r => r["لغة التدريس"]).filter(Boolean),
    };

    await redisClient.set(req.originalUrl, JSON.stringify(responseData), { EX: 3600 });
    res.json(responseData);
  } catch (error) {
    console.error('Error loading filters:', error);
    res.status(500).send('Database error');
  }
});

// Filter schools based on criteria
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

    // Build dynamic query
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

// Get detailed school information
app.get('/school-info', cacheMiddleware, async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'Missing school name' });

  try {
    const result = await pool.query(
      'SELECT * FROM "schooldata" WHERE "اسم المدرسة" = $1 LIMIT 1',
      [name]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'School not found' });
    
    await redisClient.set(req.originalUrl, JSON.stringify(result.rows[0]), { EX: 1800 });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching school info:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ====================================================================================================
// USER FORM DATA ROUTES
// ====================================================================================================
// Save user form submission
app.post('/save-form', async (req, res) => {
  const { uid, location, special_needs, language, mixed, grade } = req.body;

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

// Get user's previously saved form data
app.get('/get-user-form/:uid', async (req, res) => {
  const { uid } = req.params;

  try {
    const result = await pool.query(
      `SELECT location, special_needs, language, mixed, grade_from as grade
       FROM user_filters WHERE firebase_uid = $1 ORDER BY created_at DESC LIMIT 1`,
      [uid]
    );

    if (result.rows.length === 0) return res.json({ message: 'No data submitted' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error retrieving user form:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ====================================================================================================
// BUS TRACKING ROUTES
// ====================================================================================================
// Update driver's bus location
app.post('/track/driver', async (req, res) => {
  const { schoolId, lat, lng } = req.body;
  if (!schoolId || !lat || !lng) return res.status(400).send("Missing fields");

  console.log(`📡 Updating bus location for ${schoolId}:`, lat, lng);
  await redisClient.set(`bus:${schoolId}`, JSON.stringify({ 
    lat, lng, timestamp: Date.now() 
  }));
  res.send("Bus location updated");
});

// Get current bus location
app.get('/track/:schoolId', async (req, res) => {
  const { schoolId } = req.params;
  try {
    const data = await redisClient.get(`bus:${schoolId}`);
    if (!data) return res.status(404).send('No location available');
    
    const locationData = JSON.parse(data);
    // Check if data is stale (older than 5 minutes)
    if (Date.now() - locationData.timestamp > 300000) {
      return res.status(404).send('Location data is stale');
    }
    
    console.log(`📡 Sending bus location for ${schoolId}:`, locationData);
    res.json(locationData);
  } catch (err) {
    console.error('Error getting bus location:', err);
    res.status(500).send('Internal server error');
  }
});

// Get student's school info for tracking
app.get('/get-student-school', async (req, res) => {
  const { studentId } = req.query;
  if (!studentId) return res.status(400).json({ error: 'Missing student ID' });

  try {
    const result = await pool.query(`
      SELECT st.home_lat, st.home_lng, s.school_id, s."اسم المدرسة", s."المنطقة"
      FROM students AS st
      JOIN schooldata AS s ON st.school_id = s.school_id
      WHERE st.id = $1 LIMIT 1
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
      home: { lat: row.home_lat, lng: row.home_lng }
    });
  } catch (err) {
    console.error('Error fetching school for student:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ====================================================================================================
// VISION API ROUTES (FIXED FOR GOOGLE MAPS PHOTOS)
// ====================================================================================================

// ✅ Fixed image validation that properly handles Google Maps photos
app.post('/validate-image', async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'Missing image URL' });

  const isGoogleMapsPhoto = imageUrl.includes('maps.googleapis.com/maps/api/place/js/PhotoService.GetPhoto');
  
  console.log(`🔍 Validating image: ${imageUrl.substring(0, 100)}... (Google Maps: ${isGoogleMapsPhoto})`);

  // ✅ Special handling for Google Maps photos
  if (isGoogleMapsPhoto) {
    console.log('🗺️ Google Maps photo detected - accepting as legitimate');
    
    return res.json({
      isValidBuilding: true,
      method: 'google_maps_trusted',
      reason: 'Google Maps photos are generally legitimate school photos',
      confidence: 0.7,
      isGoogleMapsPhoto: true,
      isGenericDefault: false,
      visionApiUsed: false,
      timestamp: new Date().toISOString()
    });
  }

  // ✅ For non-Google Maps photos, use Vision API
  if (!visionEnabled || !visionClient) {
    console.log('⚠️ Vision API not available - rejecting non-Google Maps photo');
    return res.json({ 
      isValidBuilding: false,
      error: 'Vision API not available and not a Google Maps photo',
      method: 'fallback_reject',
      isGenericDefault: true,
      isGoogleMapsPhoto: false,
      timestamp: new Date().toISOString()
    });
  }

  try {
    console.log('📡 Calling Vision API for non-Google Maps image...');
    
    const [labelResult] = await visionClient.labelDetection({ 
      image: { source: { imageUri: imageUrl } }
    });

    const labels = labelResult.labelAnnotations || [];
    console.log(`📊 Vision API returned ${labels.length} labels`);
    
    if (labels.length === 0) {
      console.log('⚠️ No labels detected - rejecting image');
      return res.json({
        isValidBuilding: false,
        method: 'no_labels_detected',
        reason: 'Vision API could not analyze this image',
        isGenericDefault: true,
        isGoogleMapsPhoto: false,
        labels: [],
        timestamp: new Date().toISOString()
      });
    }

    const validation = analyzeSimpleLabels(labels);
    
    console.log(`✅ Validation complete: ${validation.isValid ? 'VALID' : 'INVALID'} building`);

    return res.json({ 
      isValidBuilding: validation.isValid,
      method: 'vision_api',
      reason: validation.reason,
      confidence: validation.confidence,
      labels: labels.slice(0, 10).map(label => ({ 
        description: label.description, 
        score: Math.round(label.score * 100) / 100 
      })),
      isGenericDefault: !validation.isValid,
      isGoogleMapsPhoto: false,
      visionApiUsed: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Vision API error:', error.message);
    
    return res.json({ 
      isValidBuilding: false,
      error: error.message,
      method: 'api_error',
      isGenericDefault: true,
      isGoogleMapsPhoto: false,
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ Simplified analysis for regular (non-Google Maps) photos
function analyzeSimpleLabels(labels) {
  const buildingKeywords = [
    'building', 'school', 'architecture', 'facade', 'structure',
    'institution', 'campus', 'education', 'exterior', 'entrance',
    'window', 'door', 'roof', 'wall', 'brick', 'concrete'
  ];

  const negativeKeywords = [
    'person', 'people', 'human', 'face', 'portrait', 'child', 'baby'
  ];

  let buildingScore = 0;
  let negativeScore = 0;

  labels.forEach(label => {
    const description = label.description.toLowerCase();
    const score = label.score || 0.5;

    if (buildingKeywords.some(keyword => description.includes(keyword))) {
      buildingScore += score;
    }
    if (negativeKeywords.some(keyword => description.includes(keyword))) {
      negativeScore += score;
    }
  });

  console.log(`📊 Simple analysis - Building: ${buildingScore.toFixed(2)}, Negative: ${negativeScore.toFixed(2)}`);

  // Decision logic
  if (buildingScore > 0.7 && negativeScore < 0.5) {
    return { isValid: true, reason: 'strong_building_evidence', confidence: 0.8 };
  } else if (buildingScore > 0.4 && negativeScore < 0.3) {
    return { isValid: true, reason: 'moderate_building_evidence', confidence: 0.6 };
  } else if (negativeScore > 0.6) {
    return { isValid: false, reason: 'high_negative_content', confidence: 0.8 };
  } else {
    return { isValid: false, reason: 'insufficient_building_evidence', confidence: 0.7 };
  }
}

// ====================================================================================================
// VISION API DEBUG ROUTES
// ====================================================================================================

// ✅ Test Vision API health
app.get('/test-vision-health', async (req, res) => {
  console.log('🔍 Testing Vision API health...');
  
  const healthCheck = {
    timestamp: new Date().toISOString(),
    visionEnabled: visionEnabled,
    visionClient: !!visionClient,
    keyfileExists: false,
    projectId: null,
    testResults: {}
  };

  // Check if keyfile exists
  try {
    const keyfilePath = path.join(__dirname, './keyfile.json');
    healthCheck.keyfileExists = fs.existsSync(keyfilePath);
    
    if (healthCheck.keyfileExists) {
      const credentials = JSON.parse(fs.readFileSync(keyfilePath, 'utf8'));
      healthCheck.projectId = credentials.project_id;
      healthCheck.clientEmail = credentials.client_email ? 'present' : 'missing';
      healthCheck.privateKey = credentials.private_key ? 'present' : 'missing';
    }
  } catch (error) {
    healthCheck.keyfileError = error.message;
  }

  // Test with a simple image if Vision API is available
  if (visionEnabled && visionClient) {
    try {
      console.log('🧪 Testing with simple image...');
      
      const testImageUrl = 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png';
      
      const [labelResult] = await visionClient.labelDetection({
        image: { source: { imageUri: testImageUrl } }
      });

      const labels = labelResult.labelAnnotations || [];
      healthCheck.testResults = {
        success: true,
        labelsFound: labels.length,
        topLabels: labels.slice(0, 3).map(label => ({
          description: label.description,
          score: Math.round(label.score * 100) / 100
        }))
      };
      
      console.log('✅ Vision API test successful');
      
    } catch (testError) {
      console.error('❌ Vision API test failed:', testError);
      healthCheck.testResults = {
        success: false,
        error: testError.message,
        code: testError.code
      };
    }
  } else {
    healthCheck.testResults = {
      success: false,
      error: 'Vision API not initialized'
    };
  }

  res.json(healthCheck);
});

// ====================================================================================================
// EMAIL ROUTES
// ====================================================================================================
// Send confirmation email
app.post('/send-confirmation', async (req, res) => {
  try {
    const { to, subject, html } = req.body;

    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to, subject, html,
    });

    res.status(200).json({ success: true, result });
  } catch (err) {
    console.error('Error sending email:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ====================================================================================================
// ERROR HANDLING & SERVER STARTUP
// ====================================================================================================
// Global error handler
app.use((err, req, res, next) => {
  console.error('🚨 Global error handler:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔍 Google Cloud Vision API: ${visionEnabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`🗺️ Google Maps photos: Always accepted as legitimate`);
  
  if (!visionEnabled) {
    console.log(`⚠️  Vision API Setup: Place keyfile.json in project root or set environment variables`);
  }
});

// Graceful shutdown
const shutdown = async () => {
  await pool.end();
  await redisClient.quit();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);