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
    const { parentName, parentEmail, studentName, studentGrade, homeAddress, schoolName, firebaseUid } = req.body;

    console.log('School selection request received:', {
      parentName,
      parentEmail,
      studentName,
      studentGrade,
      schoolName,
      firebaseUid,
      hasHomeAddress: !!homeAddress
    });

    // Validation
    if (!parentName || !parentEmail || !studentName || !studentGrade || !schoolName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    if (!firebaseUid) {
      return res.status(400).json({ 
        success: false, 
        error: 'User authentication required. Please log in first.' 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(parentEmail)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email format' 
      });
    }

    // Check if user already has a student record
    const existingStudent = await dbPool.query(
      'SELECT student_id, name, school_name FROM students WHERE firebase_uid = $1 AND (is_active IS NULL OR is_active = true)',
      [firebaseUid]
    );

    if (existingStudent.rows.length > 0) {
      const existing = existingStudent.rows[0];
      return res.status(409).json({
        success: false,
        error: 'Student profile already exists',
        details: `You already have a student profile: ${existing.name} at ${existing.school_name}`,
        existingStudentId: existing.student_id,
        suggestion: 'If you want to change schools, please contact support.'
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
        console.log('School not found in database, creating fallback school_id');
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
        firebase_uid,
        is_active,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    console.log('Inserting student with Firebase UID:', firebaseUid);
    console.log('Generated student ID:', studentId);

    const studentResult = await dbPool.query(insertQuery, [
      studentId,        // id (primary key) - using student_id as the main id since your table uses TEXT
      studentName,      // name
      schoolIdFromDb,   // school_id - use found school_id or generated one
      studentId,        // student_id - also storing in student_id column for compatibility
      parentName,       // parent_name
      parentEmail,      // parent_email
      studentGrade,     // grade
      homeAddress || null, // home_address
      schoolName,       // school_name
      firebaseUid,      // firebase_uid - IMPORTANT for location updates!
      true,             // is_active
    ]);

    const student = studentResult.rows[0];
    console.log('Student created successfully:', student);

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
        console.error('Failed to send confirmation email, but student was created successfully');
      } else {
        console.log('Confirmation email sent successfully');
      }
    } catch (emailError) {
      console.error('Email service error (non-fatal):', emailError);
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
        schoolId: student.school_id,
        firebaseUid: student.firebase_uid,
        parentName: student.parent_name,
        parentEmail: student.parent_email
      }
    });

  } catch (error) {
    console.error('Error processing school selection:', error);
    
    // Handle specific database errors
    if (error.code === '23505') {
      // Unique constraint violation
      if (error.constraint === 'students_firebase_uid_key') {
        return res.status(409).json({
          success: false,
          error: 'You already have a student profile',
          details: 'Each user can only have one student profile. If you need to change schools, please contact support.'
        });
      } else if (error.constraint === 'students_student_id_key') {
        // Student ID conflict - retry with new ID
        return res.status(500).json({
          success: false,
          error: 'Student ID conflict. Please try again.',
          details: 'A unique student ID could not be generated. Please try submitting again.'
        });
      } else {
        return res.status(409).json({
          success: false,
          error: 'Duplicate entry detected',
          details: 'This record already exists in the system.'
        });
      }
    }
    
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

    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID is required'
      });
    }

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
        s.firebase_uid,
        s.is_active,
        s.created_at,
        s.updated_at
      FROM students s
      WHERE (s.student_id = $1 OR s.id = $1) AND (s.is_active IS NULL OR s.is_active = true)
      LIMIT 1
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
        firebaseUid: student.firebase_uid,
        isActive: student.is_active,
        registeredAt: student.created_at,
        lastUpdated: student.updated_at
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

// GET /api/school-selection/check-user/:firebaseUid
router.get('/check-user/:firebaseUid', async (req, res) => {
  try {
    const { firebaseUid } = req.params;

    if (!firebaseUid) {
      return res.status(400).json({
        success: false,
        error: 'Firebase UID is required'
      });
    }

    const query = `
      SELECT 
        student_id,
        name,
        school_name,
        grade,
        is_active,
        created_at
      FROM students 
      WHERE firebase_uid = $1 AND (is_active IS NULL OR is_active = true)
      LIMIT 1
    `;

    const result = await dbPool.query(query, [firebaseUid]);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        hasStudentProfile: false,
        message: 'No student profile found for this user'
      });
    }

    const student = result.rows[0];
    
    res.json({
      success: true,
      hasStudentProfile: true,
      student: {
        studentId: student.student_id,
        name: student.name,
        schoolName: student.school_name,
        grade: student.grade,
        isActive: student.is_active,
        registeredAt: student.created_at
      }
    });

  } catch (error) {
    console.error('Error checking user student profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check student profile'
    });
  }
});

module.exports = router;