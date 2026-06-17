const mongoose = require('mongoose');

const readingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    index: true
  },
  level: {
    type: String,
    required: true,
    enum: ['very-low', 'low', 'mild', 'moderate', 'high', 'severe', 'extreme'],
    index: true
  },
  heartRate: {
    type: Number,
    min: 30,
    max: 220
  },
  temperature: {
    type: Number,
    min: 25,
    max: 42
  },
  hrv: {
    type: Number,
    min: 0,
    max: 200
  },
  calculatedScore: {
    type: Number,
    min: 0,
    max: 1
  },
  alertTriggered: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  triggers: [{
    type: String
  }],
  notes: {
    type: String,
    maxlength: 1000
  },
  source: {
    type: String,
    enum: ['sensor', 'manual', 'ai'],
    default: 'manual'
  },
  location: {
    type: {
      type: String,
      enum: ['Point']
    },
    coordinates: {
      type: [Number],
      validate: {
        validator: function (v) {
          return !v || v.length === 2;
        },
        message: 'Location coordinates must contain [longitude, latitude]'
      }
    }
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Indexes for efficient querying
readingSchema.index({ userId: 1, timestamp: -1 }); // For user's recent readings
readingSchema.index({ userId: 1, level: 1, timestamp: -1 }); // For filtering by level
readingSchema.index({ timestamp: -1 }); // For sorting by time
readingSchema.index({ location: '2dsphere' });

// Virtual for formatted date
readingSchema.virtual('formattedDate').get(function () {
  return this.timestamp.toISOString();
});

// Method to get statistics
readingSchema.statics.getUserStats = async function (userId, startDate, endDate) {
  const match = {
    userId,
    ...(startDate && endDate && {
      timestamp: { $gte: startDate, $lte: endDate }
    })
  };

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$level',
        count: { $sum: 1 },
        avgHeartRate: { $avg: '$heartRate' },
        avgTemperature: { $avg: '$temperature' }
      }
    },
    { $sort: { count: -1 } }
  ]);

  return stats;
};

const Reading = mongoose.model('Reading', readingSchema);

module.exports = Reading;
