const mongoose = require('mongoose');
// emergency controller may jitnay variable thay woh yahan apar mojood hai yeah aisi file hoti ... model kay folder may sari files aisi hoti jo kay databbae may data store karaany aky liya use hooti
const emergencyLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
        index: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true,
    },
    heartRate: Number,
    temperature: Number,
    anxietyLevel: String,
    location: {
        latitude: Number,
        longitude: Number,
        accuracy: Number,
        timestamp: Number,
    },
    isLocationShared: {
        type: Boolean,
        default: false,
    },
    sentTo: [String],
    contactsNotified: [{
        name: String,
        email: String,
        relation: String,
    }],
    triggerReason: {
        type: String,
        required: true,
    },
    alertStatus: {
        type: String,
        enum: ['sent', 'partial', 'failed'],
        default: 'sent',
    },
    deliveryResults: [{
        contactName: String,
        contactEmail: String,
        channel: {
            type: String,
            enum: ['email'],
            default: 'email',
        },
        success: Boolean,
        messageId: String,
        status: String,
        errorMessage: String,
    }],
    totalAlertsSent: { type: Number, default: 0 },
    totalAlertsFailed: { type: Number, default: 0 },
    messageSent: String,
}, {
    timestamps: true,
});

module.exports = mongoose.model('EmergencyLog', emergencyLogSchema);
