const express = require('express');
const router = express.Router();
const vision = require('@google-cloud/vision');
const path = require('path');
const fs = require('fs');

let visionApiClient = null;
let isVisionEnabled = false;

function setupVisionClient() {
  try {
    const keyfilePath = path.join(__dirname, '../keyfile.json');

    if (fs.existsSync(keyfilePath)) {
      const credentialsData = fs.readFileSync(keyfilePath, 'utf8');
      const credentials = JSON.parse(credentialsData);

      if (!credentials.private_key || !credentials.client_email) {
        console.error('ERROR: Missing required credentials in keyfile');
        return false;
      }

      visionApiClient = new vision.ImageAnnotatorClient({
        credentials: {
          private_key: credentials.private_key,
          client_email: credentials.client_email,
        },
        projectId: credentials.project_id,
      });

      console.log('Google Cloud Vision initialized with keyfile');
      return true;
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      visionApiClient = new vision.ImageAnnotatorClient();
      console.log('Google Cloud Vision initialized with environment credentials');
      return true;
    }

    console.warn('No valid Vision API credentials found');
    return false;
  } catch (error) {
    console.error('Vision API initialization failed:', error.message);
    return false;
  }
}

isVisionEnabled = setupVisionClient();

function analyzeImageLabels(labels) {
  const buildingTerms = [
    'building', 'school', 'architecture', 'facade', 'structure',
    'institution', 'campus', 'education', 'exterior', 'entrance',
    'window', 'door', 'roof', 'wall', 'brick', 'concrete'
  ];

  const badTerms = [
    'person', 'people', 'human', 'face', 'portrait', 'child', 'baby'
  ];

  let buildingScore = 0;
  let badScore = 0;

  for (let label of labels) {
    const description = label.description.toLowerCase();
    const score = label.score || 0.5;

    if (buildingTerms.some(term => description.includes(term))) {
      buildingScore += score;
    }

    if (badTerms.some(term => description.includes(term))) {
      badScore += score;
    }
  }

  console.log(`Simple analysis - Building: ${buildingScore.toFixed(2)}, Negative: ${badScore.toFixed(2)}`);

  if (buildingScore > 0.7 && badScore < 0.5) {
    return { isValid: true, reason: 'strong_building_evidence', confidence: 0.8 };
  } else if (buildingScore > 0.4 && badScore < 0.3) {
    return { isValid: true, reason: 'moderate_building_evidence', confidence: 0.6 };
  } else if (badScore > 0.6) {
    return { isValid: false, reason: 'high_negative_content', confidence: 0.8 };
  } else {
    return { isValid: false, reason: 'insufficient_building_evidence', confidence: 0.7 };
  }
}

// POST /api/vision/validate-image
router.post('/validate-image', async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'Missing image URL' });

  console.log('Validating image:', imageUrl.substring(0, 100) + '...');

  if (!isVisionEnabled || !visionApiClient) {
    return res.json({
      isValidBuilding: false,
      error: 'Vision API not available',
      method: 'fallback_reject',
      isGenericDefault: true,
      visionApiUsed: false,
      timestamp: new Date().toISOString()
    });
  }

  try {
    const imageRequest = { image: { source: { imageUri: imageUrl } } };
    const [labelResult] = await visionApiClient.labelDetection(imageRequest);
    const labels = labelResult.labelAnnotations || [];

    if (labels.length === 0) {
      return res.json({
        isValidBuilding: false,
        method: 'no_labels_detected',
        reason: 'Vision API could not analyze this image',
        isGenericDefault: true,
        labels: [],
        visionApiUsed: true,
        timestamp: new Date().toISOString()
      });
    }

    const validation = analyzeImageLabels(labels);

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
      visionApiUsed: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Vision API error:', error.message);

    return res.json({
      isValidBuilding: false,
      error: error.message,
      method: 'api_error',
      isGenericDefault: true,
      visionApiUsed: true,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/vision/rank-images
router.post('/rank-images', async (req, res) => {
  const { imageUrls } = req.body;

  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid image URLs' });
  }

  if (!isVisionEnabled || !visionApiClient) {
    return res.status(500).json({ error: 'Vision API not available' });
  }

  const results = [];

  for (const url of imageUrls) {
    try {
      const imageRequest = { image: { source: { imageUri: url } } };
      const [labelResult] = await visionApiClient.labelDetection(imageRequest);
      const labels = labelResult.labelAnnotations || [];
      const validation = analyzeImageLabels(labels);

      results.push({
        imageUrl: url,
        isValidBuilding: validation.isValid,
        reason: validation.reason,
        confidence: validation.confidence,
        labels: labels.slice(0, 5).map(label => ({
          description: label.description,
          score: Math.round(label.score * 100) / 100
        }))
      });

    } catch (err) {
      results.push({
        imageUrl: url,
        error: err.message,
        isValidBuilding: false,
        confidence: 0
      });
    }
  }

  results.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

  res.json({
    topChoice: results[0],
    allResults: results,
    timestamp: new Date().toISOString()
  });
});

// GET /api/vision/health
router.get('/health', async (req, res) => {
  const healthCheck = {
    timestamp: new Date().toISOString(),
    visionEnabled: isVisionEnabled,
    visionClient: !!visionApiClient,
    keyfileExists: false,
    projectId: null,
    testResults: {}
  };

  try {
    const keyfilePath = path.join(__dirname, '../keyfile.json');
    healthCheck.keyfileExists = fs.existsSync(keyfilePath);

    if (healthCheck.keyfileExists) {
      const credentialsContent = fs.readFileSync(keyfilePath, 'utf8');
      const credentials = JSON.parse(credentialsContent);
      healthCheck.projectId = credentials.project_id;
      healthCheck.clientEmail = credentials.client_email ? 'present' : 'missing';
      healthCheck.privateKey = credentials.private_key ? 'present' : 'missing';
    }
  } catch (error) {
    healthCheck.keyfileError = error.message;
  }

  if (isVisionEnabled && visionApiClient) {
    try {
      const testImageUrl = 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png';
      const testRequest = { image: { source: { imageUri: testImageUrl } } };
      const [labelResult] = await visionApiClient.labelDetection(testRequest);
      const labels = labelResult.labelAnnotations || [];

      healthCheck.testResults = {
        success: true,
        labelsFound: labels.length,
        topLabels: labels.slice(0, 3).map(label => ({
          description: label.description,
          score: Math.round(label.score * 100) / 100
        }))
      };
    } catch (testError) {
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

module.exports = router;
