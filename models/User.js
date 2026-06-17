const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    phoneNumber: {
        type: String,
        trim: true,
        default: ''
    },
    preferences: {
        darkMode: { type: Boolean, default: false },
        notifications: { type: Boolean, default: true },
        emergencyThreshold: {
            type: String,
            enum: ['high', 'severe', 'extreme'],
            default: 'severe'
        },
        meditationReminders: { type: Boolean, default: true }
    },
    emergencyContacts: [{
        name: { type: String, required: true },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        relation: { type: String, default: '' },
        type: { type: String, default: 'personal' },
    }],
    age: {
        type: Number,
        min: 0,
        max: 120
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other', 'Prefer not to say'],
    },
    hasSeenDemographicsPrompt: {
        type: Boolean,
        default: false
    },
    emergencyLocationConsent: {
        type: Boolean,
        default: false
    },
    emergencySharingEnabled: {
        type: Boolean,
        default: false
    },
    hyperconditionSettings: {
        threshold: {
            type: String,
            default: 'high',
            enum: ['moderate', 'high', 'severe', 'extreme']
        },
        durationMinutes: {
            type: Number,
            default: 15
        }
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
