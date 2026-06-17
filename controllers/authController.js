const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = await User.create({
            name,
            email,
            password,
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                phoneNumber: user.phoneNumber,
                preferences: user.preferences,
                emergencyContacts: user.emergencyContacts,
                age: user.age,
                gender: user.gender,
                hasSeenDemographicsPrompt: user.hasSeenDemographicsPrompt,
                emergencyLocationConsent: user.emergencyLocationConsent,
                emergencySharingEnabled: user.emergencySharingEnabled,
                hyperconditionSettings: user.hyperconditionSettings,
                token: generateToken(user._id),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        console.error('Register Error:', error);
        res.status(500).json({ message: error.message || 'Server error' });
    }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                phoneNumber: user.phoneNumber,
                preferences: user.preferences,
                emergencyContacts: user.emergencyContacts,
                age: user.age,
                gender: user.gender,
                hasSeenDemographicsPrompt: user.hasSeenDemographicsPrompt,
                emergencyLocationConsent: user.emergencyLocationConsent,
                emergencySharingEnabled: user.emergencySharingEnabled,
                hyperconditionSettings: user.hyperconditionSettings,
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: error.message || 'Server error' });
    }
};

// @desc    Update user profile (preferences & contacts)
// @route   PUT /api/auth/profile
// @access  Private
exports.updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;
            if (req.body.phoneNumber !== undefined) {
                user.phoneNumber = req.body.phoneNumber;
            }
            if (req.body.password) {
                user.password = req.body.password;
            }
            if (req.body.preferences) {
                user.preferences = { ...user.preferences, ...req.body.preferences };
            }
            if (req.body.emergencyContacts) {
                user.emergencyContacts = req.body.emergencyContacts;
            }

            // New demographic fields
            if (req.body.age !== undefined) {
                user.age = req.body.age;
            }
            if (req.body.gender !== undefined) {
                user.gender = req.body.gender;
            }
            if (req.body.hasSeenDemographicsPrompt !== undefined) {
                user.hasSeenDemographicsPrompt = req.body.hasSeenDemographicsPrompt;
            }
            if (req.body.emergencyLocationConsent !== undefined) {
                user.emergencyLocationConsent = req.body.emergencyLocationConsent;
            }
            if (req.body.emergencySharingEnabled !== undefined) {
                user.emergencySharingEnabled = req.body.emergencySharingEnabled;
            }
            if (req.body.hyperconditionSettings !== undefined) {
                user.hyperconditionSettings = {
                    ...user.hyperconditionSettings,
                    ...req.body.hyperconditionSettings
                };
            }

            const updatedUser = await user.save();

            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                phoneNumber: updatedUser.phoneNumber,
                preferences: updatedUser.preferences,
                emergencyContacts: updatedUser.emergencyContacts,
                age: updatedUser.age,
                gender: updatedUser.gender,
                hasSeenDemographicsPrompt: updatedUser.hasSeenDemographicsPrompt,
                emergencyLocationConsent: updatedUser.emergencyLocationConsent,
                emergencySharingEnabled: updatedUser.emergencySharingEnabled,
                hyperconditionSettings: updatedUser.hyperconditionSettings,
                token: generateToken(updatedUser._id),
            });
        }
        else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Update Profile Error:', error);
        res.status(500).json({ message: error.message || 'Server error' });
    }
};
