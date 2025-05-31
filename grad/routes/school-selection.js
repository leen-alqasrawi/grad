const express = require('express');
const router = express.Router();
const { dbPool } = require('../config/database');

// Function to generate unique student ID
function generateStudentId() {
  const prefix = 'STU';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
}

// POST /api/school-selection/submit
router.post('/submit', async (req, res) => {
  try {
    const { parentName, parentEmail, studentName, studentGrade, homeAddress, schoolName } = req.body;

    // Validation
    if (!parentName || !parentEmail || !studentName || !studentGrade || !schoolName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(parentEmail)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email format' 
      });
    }

    // Generate unique student ID
    const studentId = generateStudentId();

    // Get school information from database using correct Arabic column name
    let schoolData = null;
    let schoolIdFromDb = null;
    
    try {
      console.log('Looking for school:', schoolName);
      
      // Query using the correct Arabic column name "اسم المدرسة"
      const schoolQuery = 'SELECT * FROM "schooldata" WHERE "اسم المدرسة" = $1 LIMIT 1';
      const schoolResult = await dbPool.query(schoolQuery, [schoolName]);
      
      if (schoolResult.rows.length > 0) {
        schoolData = schoolResult.rows[0];
        schoolIdFromDb = schoolData.school_id;
        console.log('Found school with ID:', schoolIdFromDb);
      } else {
        console.log('School not found, will create new school_id');
        // If school not found, we'll create a new school_id based on student_id
        schoolIdFromDb = `SCH_${studentId}`;
      }
    } catch (err) {
      console.error('Error fetching school data:', err);
      // Fallback: create school_id from student_id
      schoolIdFromDb = `SCH_${studentId}`;
    }

    // Insert student record using your existing table structure
    const insertQuery = `
      INSERT INTO students (
        id,
        name, 
        school_id,
        student_id, 
        parent_name, 
        parent_email, 
        grade, 
        home_address, 
        school_name,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *
    `;

    console.log('Inserting student with school_id:', schoolIdFromDb);

    const studentResult = await dbPool.query(insertQuery, [
      studentId, // Using student_id as the main id since your table uses TEXT
      studentName,
      schoolIdFromDb, // Use found school_id or generated one
      studentId, // Also storing in student_id column
      parentName,
      parentEmail,
      studentGrade,
      homeAddress || null,
      schoolName
    ]);

    const student = studentResult.rows[0];

    // Send confirmation email
    try {
      const emailResponse = await fetch('http://localhost:5000/api/email/send-student-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parentName,
          parentEmail,
          studentName,
          studentId,
          schoolName,
          studentGrade,
          schoolData
        })
      });

      if (!emailResponse.ok) {
        console.error('Failed to send confirmation email');
      } else {
        console.log('Confirmation email sent successfully');
      }
    } catch (emailError) {
      console.error('Email service error:', emailError);
    }

    res.json({
      success: true,
      message: 'School selection submitted successfully',
      studentId: studentId,
      student: {
        id: student.id,
        studentId: student.student_id,
        name: student.name,
        grade: student.grade,
        schoolName: student.school_name,
        schoolId: student.school_id
      }
    });

  } catch (error) {
    console.error('Error processing school selection:', error);
    
    // Handle specific database errors
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        error: 'Database constraint error. Please try again or contact support.'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to process school selection: ' + error.message
    });
  }
});

// GET /api/school-selection/student/:studentId
router.get('/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;

    const query = `
      SELECT 
        s.id,
        s.student_id,
        s.name,
        s.parent_name,
        s.parent_email,
        s.grade,
        s.home_address,
        s.school_name,
        s.school_id,
        s.home_lat,
        s.home_lng,
        s.created_at
      FROM students s
      WHERE s.student_id = $1 OR s.id = $1
    `;

    const result = await dbPool.query(query, [studentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    const student = result.rows[0];
    
    res.json({
      success: true,
      student: {
        studentId: student.student_id || student.id,
        name: student.name,
        parentName: student.parent_name,
        parentEmail: student.parent_email,
        grade: student.grade,
        homeAddress: student.home_address,
        schoolName: student.school_name,
        schoolId: student.school_id,
        homeLocation: {
          lat: student.home_lat,
          lng: student.home_lng
        },
        registeredAt: student.created_at
      }
    });

  } catch (error) {
    console.error('Error fetching student data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch student data'
    });
  }
});

module.exports = router;