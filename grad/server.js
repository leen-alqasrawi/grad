const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

// Import routes
const reviewRoutes = require('./routes/reviews');
const schoolRoutes = require('./routes/schools');
const userRoutes = require('./routes/users');
const visionRoutes = require('./routes/vision');
const emailRoutes = require('./routes/email');
const schoolSelectionRoutes = require('./routes/school-selection');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: ['http://localhost:5501', 'http://127.0.0.1:5501'],
  credentials: true
}));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Use routes
app.use('/api/reviews', reviewRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vision', visionRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/school-selection', schoolSelectionRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.send('App is running and listening on /');
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
  console.log('Firebase tracking system enabled');
  console.log('School selection system enabled');
});

const gracefulShutdown = async () => {
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);