// Dialogflow Controller
// This controller will handle Dialogflow integration for the chatbot
// TODO: Install Dialogflow SDK: npm install @google-cloud/dialogflow

/**
 * Process a user message through Dialogflow
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const dialogflow = require('@google-cloud/dialogflow');
const uuid = require('uuid');

// Dialogflow Controller

/**
 * Process a user message through Dialogflow with anxiety context
 */
exports.processMessage = async (req, res) => {
  try {
    const { message, userId, sessionId, anxietyLevel } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Use provided sessionId or generate a new one (in a real app, persist this)
    const currentSessionId = sessionId || uuid.v4();

    // Configuration from environment variables
    const projectId = process.env.DIALOGFLOW_PROJECT_ID;
    const clientEmail = process.env.DIALOGFLOW_CLIENT_EMAIL;
    const privateKey = process.env.DIALOGFLOW_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      console.warn('Dialogflow credentials missing in .env');
      return res.status(500).json({
        success: false,
        error: 'Dialogflow credentials missing in environment variables'
      });
    }

    // Create a new session client
    const sessionClient = new dialogflow.SessionsClient({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      projectId: projectId,
    });

    const sessionPath = sessionClient.projectAgentSessionPath(projectId, currentSessionId);

    // Map anxiety level to context
    // Expected levels from frontend: 'low', 'moderate', 'high', etc.
    // Dialogflow contexts: 'context-normal', 'context-mild', 'context-severe'
    let contextName = 'context-normal';
    let lifespanCount = 5;

    if (anxietyLevel) {
      switch (anxietyLevel.toLowerCase()) {
        case 'high':
        case 'severe':
        case 'extreme':
          contextName = 'context-severe';
          break;
        case 'moderate':
        case 'mild':
          contextName = 'context-mild';
          break;
        case 'low':
        case 'very-low':
        default:
          contextName = 'context-normal';
          break;
      }
    }

    // Context object to send
    const contextObject = {
      name: `${sessionPath}/contexts/${contextName}`,
      lifespanCount: lifespanCount,
    };

    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: message,
          languageCode: 'en-US',
        },
      },
      queryParams: {
        contexts: [contextObject]
      }
    };

    const [response] = await sessionClient.detectIntent(request);
    const result = response.queryResult;

    res.json({
      success: true,
      data: {
        reply: result.fulfillmentText,
        sessionId: currentSessionId,
        intent: result.intent?.displayName,
        confidence: result.intentDetectionConfidence,
        parameters: result.parameters?.fields
      }
    });

  } catch (error) {
    console.error('Error processing Dialogflow message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message',
      message: error.message
    });
  }
};

/**
 * Create a new Dialogflow session
 */
exports.createSession = async (req, res) => {
  try {
    const { userId } = req.body;
    const sessionId = uuid.v4();

    res.json({
      success: true,
      data: {
        sessionId: sessionId,
        message: 'Session initiated'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get context (Placeholder)
 */
exports.getContext = async (req, res) => {
  // Not strictly needed for this integration phase
  res.json({ success: true, message: 'Not implemented' });
};

