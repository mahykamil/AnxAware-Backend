const express = require('express');
const router = express.Router();
const signalsController = require('../controllers/signalsController');
const { protect } = require('../middleware/auth');

// All signal routes are protected
router.use(protect);

// Analyze and optionally save a raw JSON signal
router.post('/analyze', signalsController.analyzeSignal);

module.exports = router;
