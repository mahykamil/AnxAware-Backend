const Reading = require('../models/Reading');
const { validationResult } = require('express-validator');
const scoringLogic = require('../utils/scoringLogic');
const alertService = require('../services/alertService');
const { processAutomaticEmergencyAlert } = require('../utils/emergencyTrigger');

const normalizeLocationToGeoJSON = (location) => {
  if (!location || location.latitude === undefined || location.longitude === undefined) {
    return undefined;
  }
  return {
    type: 'Point',
    coordinates: [Number(location.longitude), Number(location.latitude)]
  };
};



// Get all readings for a user with sorting and filtering
exports.getReadings = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      sortBy = 'timestamp',
      sortOrder = 'desc',
      level,
      startDate,
      endDate,
      limit = 50,
      page = 1
    } = req.query;

    // Build query
    const query = { userId };

    // Filter by level if provided
    if (level) {
      query.level = level;
    }

    // Filter by date range if provided
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }

    // Validate sort order
    const sortOrderValue = sortOrder.toLowerCase() === 'asc' ? 1 : -1;

    // Validate sort field
    const allowedSortFields = ['timestamp', 'level', 'heartRate', 'temperature', 'createdAt'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'timestamp';

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const readings = await Reading.find(query)
      .sort({ [sortField]: sortOrderValue })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Get total count for pagination
    const total = await Reading.countDocuments(query);

    res.json({
      success: true,
      data: readings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching readings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch readings',
      message: error.message
    });
  }
};

// Get a single reading by ID
exports.getReadingById = async (req, res) => {
  try {
    const { id } = req.params;
    const reading = await Reading.findById(id);

    if (!reading) {
      return res.status(404).json({
        success: false,
        error: 'Reading not found'
      });
    }

    // Check ownership
    if (reading.userId.toString() !== req.user._id.toString()) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized'
      });
    }

    res.json({
      success: true,
      data: reading
    });
  } catch (error) {
    console.error('Error fetching reading:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reading',
      message: error.message
    });
  }
};

// Create multiple readings (Batch)
exports.createBatchReadings = async (req, res) => {
  try {
    const readings = req.body;

    if (!Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid batch data',
        message: 'Expected an array of readings'
      });
    }

    // Map readings to include userId from token and ensure timestamps
    const readingsToInsert = readings.map(reading => {
      const vitals = {
        heartRate: reading.heartRate,
        hrv: reading.hrv,
        temperature: reading.temperature
      };

      const calculatedScore = scoringLogic.calculateFinalAnxietyScore(
        reading.level,
        vitals
      );

      const alertTriggered = alertService.shouldTriggerAlert(req.user._id, calculatedScore);

      return {
        userId: req.user._id,
        level: reading.level,
        heartRate: reading.heartRate,
        temperature: reading.temperature,
        hrv: reading.hrv,
        calculatedScore: calculatedScore,
        alertTriggered: alertTriggered,
        timestamp: reading.timestamp ? new Date(reading.timestamp) : new Date(),
        triggers: reading.triggers || [],
        notes: reading.notes,
        source: reading.source || 'sensor',
        location: normalizeLocationToGeoJSON(reading.location)
      };
    });

    const result = await Reading.insertMany(readingsToInsert);

    // Check for hypercondition after batch insert
    const hypercondition = await alertService.checkHypercondition(req.user._id);
    const emergencyAlert = await processAutomaticEmergencyAlert(
      req.user._id,
      result,
      hypercondition
    );

    res.status(201).json({
      success: true,
      data: result,
      count: result.length,
      hypercondition: hypercondition.detected ? hypercondition : undefined,
      emergencyAlert: emergencyAlert?.dispatched ? emergencyAlert : undefined,
      message: `Successfully saved ${result.length} readings`
    });
  } catch (error) {
    console.error('Error creating batch readings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create batch readings',
      message: error.message
    });
  }
};

// Create a new reading
exports.createReading = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const vitals = {
      heartRate: req.body.heartRate,
      hrv: req.body.hrv,
      temperature: req.body.temperature
    };

    const calculatedScore = scoringLogic.calculateFinalAnxietyScore(
      req.body.level,
      vitals
    );

    const alertTriggered = alertService.shouldTriggerAlert(req.user._id, calculatedScore);

    const readingData = {
      userId: req.user._id,
      level: req.body.level,
      heartRate: req.body.heartRate,
      temperature: req.body.temperature,
      hrv: req.body.hrv,
      calculatedScore: calculatedScore,
      alertTriggered: alertTriggered,
      timestamp: req.body.timestamp ? new Date(req.body.timestamp) : new Date(),
      triggers: req.body.triggers || [],
      notes: req.body.notes,
      source: req.body.source || 'manual',
      location: normalizeLocationToGeoJSON(req.body.location)
    };

    const reading = new Reading(readingData);
    await reading.save();

    // Check for hypercondition
    const hypercondition = await alertService.checkHypercondition(req.user._id);
    const emergencyAlert = await processAutomaticEmergencyAlert(
      req.user._id,
      [reading],
      hypercondition
    );

    res.status(201).json({
      success: true,
      data: reading,
      hypercondition: hypercondition.detected ? hypercondition : undefined,
      emergencyAlert: emergencyAlert?.dispatched ? emergencyAlert : undefined,
      message: 'Reading created successfully'
    });
  } catch (error) {
    console.error('Error creating reading:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create reading',
      message: error.message
    });
  }
};

// Update a reading
exports.updateReading = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated
    delete updates._id;
    delete updates.createdAt;

    const reading = await Reading.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!reading) {
      return res.status(404).json({
        success: false,
        error: 'Reading not found or not authorized'
      });
    }
    res.json({
      success: true,
      data: reading,
      message: 'Reading updated successfully'
    });
  } catch (error) {
    console.error('Error updating reading:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update reading',
      message: error.message
    });
  }
};

// Delete a reading
exports.deleteReading = async (req, res) => {
  try {
    const { id } = req.params;
    const reading = await Reading.findOneAndDelete({ _id: id, userId: req.user._id });

    if (!reading) {
      return res.status(404).json({
        success: false,
        error: 'Reading not found or not authorized'
      });
    }

    res.json({
      success: true,
      message: 'Reading deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting reading:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete reading',
      message: error.message
    });
  }
};

// Get statistics for a user
exports.getStatistics = async (req, res) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    // Get level distribution
    const stats = await Reading.getUserStats(userId, start, end);

    // Get total count
    const totalReadings = await Reading.countDocuments({
      userId,
      ...(start && end && {
        timestamp: { $gte: start, $lte: end }
      })
    });

    // Get average heart rate and temperature
    const averages = await Reading.aggregate([
      {
        $match: {
          userId,
          ...(start && end && {
            timestamp: { $gte: start, $lte: end }
          })
        }
      },
      {
        $group: {
          _id: null,
          avgHeartRate: { $avg: '$heartRate' },
          avgTemperature: { $avg: '$temperature' },
          minHeartRate: { $min: '$heartRate' },
          maxHeartRate: { $max: '$heartRate' },
          minTemperature: { $min: '$temperature' },
          maxTemperature: { $max: '$temperature' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalReadings,
        levelDistribution: stats,
        averages: averages[0] || {}
      }
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
};

// Get recent readings (last N readings)
exports.getRecentReadings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 10 } = req.query;

    // Get start of today (local time consideration might be needed, but server time simple start of day is safer for now)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const readings = await Reading.find({
      userId,
      timestamp: { $gte: startOfDay }
    })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: readings
    });
  } catch (error) {
    console.error('Error fetching recent readings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent readings',
      message: error.message
    });
  }
};

// Generate an Awareness Report
exports.getMonitoringReport = async (req, res) => {
  try {
    const userId = req.user._id;
    const { period, startDate: customStart, endDate: customEnd } = req.query;

    let endDate = customEnd ? new Date(customEnd) : new Date();
    let startDate = customStart ? new Date(customStart) : new Date();

    if (!customStart) {
      if (period === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
      } else {
        startDate.setDate(startDate.getDate() - 7);
      }
    }

    const readings = await Reading.find({
      userId,
      timestamp: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: 1 });

    if (!readings || readings.length === 0) {
      return res.json({
        success: true,
        data: {
          period,
          disclaimer: "Step-based awareness tool. No data recorded for this period.",
          summary: "No data recorded for this period. Try manual check-ins once a day.",
          insights: [],
          totalReadings: 0,
          anxiousEpisodesCount: 0,
          episodes: []
        }
      });
    }

    // Identify High Anxiety Episodes (Level >= Moderate / Score >= 0.5)
    // If multiple readings are within 30 mins, treat as one episode
    const episodes = [];
    let currentEpisode = null;

    readings.forEach(reading => {
      const isHigh = scoringLogic.mapLevelToScore(reading.level) >= 0.5;

      if (isHigh) {
        if (!currentEpisode) {
          currentEpisode = {
            startTime: reading.timestamp,
            endTime: reading.timestamp,
            maxLevel: reading.level,
            readings: 1
          };
        } else {
          const timeDiff = (reading.timestamp - currentEpisode.endTime) / (1000 * 60);
          if (timeDiff <= 30) {
            currentEpisode.endTime = reading.timestamp;
            currentEpisode.readings++;
            if (scoringLogic.mapLevelToScore(reading.level) > scoringLogic.mapLevelToScore(currentEpisode.maxLevel)) {
              currentEpisode.maxLevel = reading.level;
            }
          } else {
            episodes.push(currentEpisode);
            currentEpisode = {
              startTime: reading.timestamp,
              endTime: reading.timestamp,
              maxLevel: reading.level,
              readings: 1
            };
          }
        }
      } else if (currentEpisode) {
        // Gap in high anxiety, but maybe same episode if soon?
        // For simplicity, we end episode if next reading is low
        episodes.push(currentEpisode);
        currentEpisode = null;
      }
    });
    if (currentEpisode) episodes.push(currentEpisode);

    // Filter episodes that lasted more than 15 minutes or had multiple readings
    // OR were manual entries (manual entries are always significant for awareness)
    const significantEpisodes = episodes.filter(e => {
      const episodeReadings = readings.filter(r => r.timestamp >= e.startTime && r.timestamp <= e.endTime);
      const hasManual = episodeReadings.some(r => r.source === 'manual' || r.notes);
      const duration = (e.endTime - e.startTime) / (1000 * 60);
      return duration >= 15 || e.readings >= 2 || hasManual;
    });

    // Generate Demographic-Based Insights
    const demographicInsights = [];
    const hasDemographicData = req.user.age && req.user.gender;

    if (hasDemographicData) {
      const { age, gender } = req.user;
      // Simple age/gender based logic for insights
      if (gender === 'Female' && age >= 18 && age <= 35) {
        demographicInsights.push("Young adult females in your age group often report higher sensitivity to physiological stress indicators.");
      } else if (gender === 'Male' && age >= 40) {
        demographicInsights.push("Men over 40 may experience anxiety differently, often manifesting as physical tension.");
      }

      if (age < 25) {
        demographicInsights.push("For younger users, sleep patterns and digital screen time are frequent correlations with anxiety spikes.");
      }
    }

    // Generate Summary Message
    const insights = [...demographicInsights];
    if (significantEpisodes.length > 0) {
      significantEpisodes.forEach(e => {
        const episodeReadings = readings.filter(r => r.timestamp >= e.startTime && r.timestamp <= e.endTime);
        const hasManual = episodeReadings.some(r => r.source === 'manual' || r.notes);
        const avgHR = episodeReadings.reduce((sum, r) => sum + (r.heartRate || 0), 0) / episodeReadings.length;
        const avgHRV = episodeReadings.reduce((sum, r) => sum + (r.hrv || 0), 0) / episodeReadings.length;

        let insight = `Elevated anxiety detected between ${new Date(e.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} and ${new Date(e.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;

        let correlations = [];
        if (hasManual) correlations.push("you manually reported feeling anxious");
        if (avgHR > scoringLogic.BASELINES.heartRate + 15) correlations.push("heart rate was elevated");
        if (avgHRV < scoringLogic.BASELINES.hrv - 15) correlations.push("HRV was significantly reduced");

        if (correlations.length > 0) {
          insight += ` During this time, ${correlations.join(", ")}.`;
        }
        insights.push(insight);
      });
    }

    let summary = "Your anxiety levels look stable for this period.";
    if (significantEpisodes.length > 5) {
      summary = `It looks like you had ${significantEpisodes.length} periods of persistent anxiety this ${period}. Reflecting on what triggered these moments could be helpful.`;
    } else if (significantEpisodes.length > 0) {
      summary = `You had ${significantEpisodes.length} notable moments of anxiety this ${period}. Awareness is the first step!`;
    }

    res.json({
      success: true,
      data: {
        period,
        disclaimer: hasDemographicData
          ? "Step-based awareness tool. Not a medical device or diagnosis."
          : "Step-based awareness tool. Demographic data was not provided by the user, so age/gender specific insights are limited.",
        summary,
        insights,
        totalReadings: readings.length,
        anxiousEpisodesCount: significantEpisodes.length,
        episodes: significantEpisodes.map(e => ({
          startTime: e.startTime,
          endTime: e.endTime,
          durationMins: Math.round((e.endTime - e.startTime) / 60000),
          maxLevel: e.maxLevel,
          readingCount: e.readings
        }))
      }
    });

  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate report'
    });
  }
};
