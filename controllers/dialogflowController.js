/**
 * Dialogflow Controller
 * Handles Dialogflow integration for AI chatbot with anxiety context awareness
 * 
 * Environment variables required:
 * - DIALOGFLOW_PROJECT_ID
 * - DIALOGFLOW_CLIENT_EMAIL
 * - DIALOGFLOW_PRIVATE_KEY
 */

const dialogflow = require('@google-cloud/dialogflow');
const uuid = require('uuid');

/**
 * Process a user message through Dialogflow with anxiety context
 */
exports.processMessage = async (req, res) => {
  try {
    const { message, sessionId, anxietyLevel } = req.body;

    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message is required' 
      });
    }

    // Use provided sessionId or generate a new one
    const currentSessionId = sessionId || uuid.v4();

    // Configuration from environment variables
    const projectId = process.env.DIALOGFLOW_PROJECT_ID;
    const clientEmail = process.env.DIALOGFLOW_CLIENT_EMAIL;
    const privateKey = process.env.DIALOGFLOW_PRIVATE_KEY
      ? process.env.DIALOGFLOW_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined;

    // Check if Dialogflow is configured
    if (!projectId || !clientEmail || !privateKey) {
      console.warn('⚠️  Dialogflow: Credentials missing in environment variables');
      
      // Return a fallback response instead of error
      return res.json({
        success: true,
        data: {
          reply: "I'm here to help! However, the AI chatbot isn't fully configured yet. Please reach out to support for assistance with your anxiety management.",
          sessionId: currentSessionId,
          intent: 'fallback',
          confidence: 0,
          isFallback: true
        }
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
    const sessionId = uuid.v4();

    res.json({
      success: true,
      data: {
        sessionId: sessionId,
        message: 'Chat session created successfully'
      }
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create session',
      message: error.message 
    });
  }
};

/**
 * Health check for Dialogflow integration
 */
exports.getContext = async (req, res) => {
  try {
    const projectId = process.env.DIALOGFLOW_PROJECT_ID;
    const clientEmail = process.env.DIALOGFLOW_CLIENT_EMAIL;
    const privateKey = process.env.DIALOGFLOW_PRIVATE_KEY;

    const isConfigured = !!(projectId && clientEmail && privateKey);

    res.json({ 
      success: true, 
      configured: isConfigured,
      message: isConfigured 
        ? 'Dialogflow is configured and ready' 
        : 'Dialogflow credentials not configured'
    });
  } catch (error) {
    console.error('Error checking Dialogflow context:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

