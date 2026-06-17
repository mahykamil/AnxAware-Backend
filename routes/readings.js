const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const readingsController = require('../controllers/readingsController');

// Validation middleware
const readingValidation = [
  body('level').isIn(['very-low', 'low', 'mild', 'moderate', 'high', 'severe', 'extreme'])
    .withMessage('Invalid anxiety level'),
  body('heartRate').optional().isFloat({ min: 30, max: 220 })
    .withMessage('Heart rate must be between 30 and 220'),
  body('temperature').optional().isFloat({ min: 25, max: 42 })
    .withMessage('Temperature must be between 25 and 42'),
  body('hrv').optional().isFloat({ min: 0, max: 200 })
    .withMessage('HRV must be between 0 and 200'),
  body('timestamp').optional().isISO8601().withMessage('Invalid timestamp format'),
  body('notes').optional().isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters')
];

// Routes
const { protect } = require('../middleware/auth');

// Routes
// All routes are protected
router.use(protect);

router.get('/', readingsController.getReadings);
router.get('/report', readingsController.getMonitoringReport);
router.get('/recent', readingsController.getRecentReadings);
router.get('/statistics', readingsController.getStatistics);
router.get('/:id', readingsController.getReadingById);
router.post('/batch', readingsController.createBatchReadings);
router.post('/', readingValidation, readingsController.createReading);
router.put('/:id', readingsController.updateReading);
router.delete('/:id', readingsController.deleteReading);

module.exports = router;
