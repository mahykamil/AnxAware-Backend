const EmergencyLog = require('../models/EmergencyLog');
const User = require('../models/User');
const emailService = require('./emailService');

const COOLDOWN_PERIOD_MS = 30 * 60 * 1000;
const HIGH_LEVELS = ['high', 'severe', 'extreme'];

const SUBJECT = '🚨 Emergency Alert: Anxiety Episode Detected';

/**
 * Normalize contact from DB (supports legacy `number` field — email-only going forward).
 */
function getContactEmail(contact) {
    if (contact.email) return contact.email.trim().toLowerCase();
    return null;
}

function normalizeLocation(location) {
    if (!location) return null;
    if (location.latitude !== undefined && location.longitude !== undefined) {
        return {
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
        };
    }
    if (location.coordinates && Array.isArray(location.coordinates)) {
        return {
            longitude: Number(location.coordinates[0]),
            latitude: Number(location.coordinates[1]),
        };
    }
    return null;
}

function buildMapsLink(location) {
    const loc = normalizeLocation(location);
    if (!loc) return null;
    return `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`;
}

function buildEmailBodies(user, { heartRate, temperature, location, triggerReason, anxietyLevel }) {
    const timestamp = new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });

    const hrLine = heartRate != null ? `${heartRate} BPM` : 'Not available';
    const tempLine = temperature != null ? `${temperature} °C` : 'Not available';
    const mapsLink = buildMapsLink(location);
    const locationLine = mapsLink
        ? mapsLink
        : 'Location unavailable at the time of alert.';

    let contextLine = 'An anxiety episode has been detected.';
    if (triggerReason === 'manual_user_trigger' || triggerReason === 'sos_button') {
        contextLine = `${user.name} manually triggered an emergency alert.`;
    } else if (triggerReason && triggerReason.startsWith('hypercondition:')) {
        contextLine = `Sustained high anxiety was detected for ${user.name}.`;
    } else if (anxietyLevel) {
        contextLine = `High anxiety level (${anxietyLevel}) was detected for ${user.name}.`;
    }

    const text = [
        contextLine,
        '',
        `Heart Rate: ${hrLine}`,
        `Temperature: ${tempLine}`,
        `Time: ${timestamp}`,
        '',
        `Location: ${locationLine}`,
        '',
        'Please check immediately.',
        '',
        '— Sent via AnxAware Emergency System',
    ].join('\n');

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h2 style="color: #c62828;">🚨 Emergency Alert: Anxiety Episode Detected</h2>
            <p>${contextLine}</p>
            <table style="margin: 16px 0; border-collapse: collapse;">
                <tr><td style="padding: 4px 12px 4px 0;"><strong>Heart Rate</strong></td><td>${hrLine}</td></tr>
                <tr><td style="padding: 4px 12px 4px 0;"><strong>Temperature</strong></td><td>${tempLine}</td></tr>
                <tr><td style="padding: 4px 12px 4px 0;"><strong>Time</strong></td><td>${timestamp}</td></tr>
            </table>
            <p><strong>Location:</strong><br/>
            ${mapsLink
            ? `<a href="${mapsLink}">${mapsLink}</a>`
            : 'Location unavailable at the time of alert.'}
            </p>
            <p style="color: #666;">Please check immediately.</p>
            <hr/>
            <p style="font-size: 12px; color: #999;">— Sent via AnxAware Emergency System</p>
        </div>
    `;

    return { text, html, mapsLink };
}

async function wasRecentlyAlerted(userId, skipCooldown = false) {
    if (skipCooldown) return false;
    const lastEmergency = await EmergencyLog.findOne({ userId }).sort({ createdAt: -1 });
    if (!lastEmergency) return false;
    return Date.now() - new Date(lastEmergency.createdAt).getTime() < COOLDOWN_PERIOD_MS;
}

function isHighAnxietyLevel(level) {
    return level && HIGH_LEVELS.includes(String(level).toLowerCase());
}

/**
 * Dispatch emergency emails to all contacts for a user.
 *
 * @param {string|ObjectId} userId
 * @param {Object} options
 * @param {Object} [options.location] - { latitude, longitude } or GeoJSON Point
 * @param {string} [options.triggerReason]
 * @param {number} [options.heartRate]
 * @param {number} [options.temperature]
 * @param {string} [options.anxietyLevel]
 * @param {boolean} [options.skipCooldown] - true for manual SOS
 * @returns {Promise<Object>}
 */
async function dispatchEmergencyAlert(userId, options = {}) {
    const startTime = Date.now();
    const {
        location,
        triggerReason = 'anxiety_detected',
        heartRate,
        temperature,
        anxietyLevel,
        skipCooldown = false,
    } = options;

    const user = await User.findById(userId);
    if (!user) {
        return { dispatched: false, success: false, message: 'User not found' };
    }

    if (!user.emergencySharingEnabled) {
        return {
            dispatched: false,
            success: false,
            message: 'Emergency sharing is disabled',
        };
    }

    const isManual = triggerReason === 'manual_user_trigger' || triggerReason === 'sos_button';
    if (!isManual && await wasRecentlyAlerted(userId)) {
        console.log(`   ⏳ Emergency alert suppressed (cooldown) for user ${userId}`);
        return {
            dispatched: false,
            success: false,
            message: 'Alert suppressed due to cooldown',
            suppressed: true,
        };
    }

    const contacts = (user.emergencyContacts || []).filter((c) => getContactEmail(c));
    if (contacts.length === 0) {
        return {
            dispatched: false,
            success: false,
            message: 'No emergency contacts with email addresses configured',
        };
    }

    const normalizedLocation = normalizeLocation(location);
    const { text, html } = buildEmailBodies(user, {
        heartRate,
        temperature,
        location: normalizedLocation,
        triggerReason,
        anxietyLevel,
    });

    console.log('\n🚨 ════════════════════════════════════════');
    console.log('   EMERGENCY EMAIL ALERT');
    console.log('════════════════════════════════════════');
    console.log(`   User:     ${user.name} (${user.email})`);
    console.log(`   Reason:   ${triggerReason}`);
    console.log(`   Level:    ${anxietyLevel || 'n/a'}`);
    console.log(`   HR/Temp:  ${heartRate ?? 'n/a'} / ${temperature ?? 'n/a'}`);
    console.log(`   Contacts: ${contacts.length}`);

    const deliveryResults = await Promise.all(
        contacts.map(async (contact) => {
            const email = getContactEmail(contact);
            console.log(`\n📧 Sending to "${contact.name}" <${email}>`);
            const result = await emailService.sendEmail(email, SUBJECT, text, html);
            return {
                contactName: contact.name,
                contactEmail: email,
                channel: 'email',
                success: result.success,
                messageId: result.messageId || null,
                status: result.status || null,
                errorMessage: result.error || null,
            };
        })
    );

    const successCount = deliveryResults.filter((r) => r.success).length;
    const failedCount = deliveryResults.filter((r) => !r.success).length;
    const sentTo = deliveryResults.filter((r) => r.success).map((r) => r.contactEmail);

    let alertStatus = 'sent';
    if (successCount === 0) alertStatus = 'failed';
    else if (failedCount > 0) alertStatus = 'partial';

    const log = await EmergencyLog.create({
        userId,
        heartRate,
        temperature,
        anxietyLevel: anxietyLevel || null,
        location: normalizedLocation
            ? {
                latitude: normalizedLocation.latitude,
                longitude: normalizedLocation.longitude,
            }
            : undefined,
        isLocationShared: !!normalizedLocation,
        sentTo,
        contactsNotified: contacts.map((c) => ({
            name: c.name,
            email: getContactEmail(c),
            relation: c.relation || '',
        })),
        triggerReason,
        alertStatus,
        deliveryResults,
        totalAlertsSent: successCount,
        totalAlertsFailed: failedCount,
        messageSent: text,
    });

    console.log(`\n   📊 RESULTS: ${successCount} sent, ${failedCount} failed (${alertStatus})`);
    console.log(`   ⏱️  Completed in ${Date.now() - startTime}ms\n`);

    return {
        dispatched: true,
        success: successCount > 0,
        alertStatus,
        logId: log._id,
        sentTo,
        summary: {
            totalContacts: contacts.length,
            totalAlertsSent: successCount,
            totalAlertsFailed: failedCount,
            durationMs: Date.now() - startTime,
        },
        deliveryResults,
        message:
            alertStatus === 'sent'
                ? 'Emergency emails sent successfully'
                : alertStatus === 'partial'
                    ? `${successCount} emails sent, ${failedCount} failed`
                    : 'All emergency emails failed to send',
    };
}

module.exports = {
    dispatchEmergencyAlert,
    isHighAnxietyLevel,
    buildMapsLink,
    normalizeLocation,
    HIGH_LEVELS,
};
