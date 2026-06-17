const express = require('express');
const router = express.Router();
const dialogflowController = require('../controllers/dialogflowController');

// Routes for Dialogflow integration
router.post('/message', dialogflowController.processMessage);
router.post('/session', dialogflowController.createSession);
router.get('/session/:sessionId/context', dialogflowController.getContext);

module.exports = router;
