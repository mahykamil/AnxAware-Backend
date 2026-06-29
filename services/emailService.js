const nodemailer = require('nodemailer');

/**
 * Email delivery via Nodemailer (SMTP)
 * Configure with:
 * SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
 */

class EmailService {
    constructor() {
        this.from = process.env.EMAIL_FROM || 'AnxAware Alerts <alerts@anxaware.app>';
        this.transporter = null;

        // ✅ FIX: correct function call
        this._init();
    }

    /**
     * Initialize SMTP transporter
     */
    _init() {
        const host = process.env.SMTP_HOST;
        const port = parseInt(process.env.SMTP_PORT || '587', 10);
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
         console.log("SMTP_HOST:", host);
    console.log("SMTP_PORT:", port);
    console.log("SMTP_USER:", user);

        if (!host || !user || !pass) {
            console.warn('⚠️ Email: SMTP not fully configured');
            return;
        }

        this.transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465, // true for 465, false for 587
            auth: {
                user,
                pass,
            },

            // 🔥 prevents Railway / network TLS issues
            tls: {
                rejectUnauthorized: false,
            },

            // 🔥 prevent hanging connections
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
        });

        console.log('──────────────────────────────────────');
        console.log('📧 Email Service Initialization');
        console.log('──────────────────────────────────────');
        console.log(`   SMTP Host:  ${host}:${port}`);
        console.log(`   From:       ${this.from}`);
        console.log('──────────────────────────────────────');
    }

    /**
     * Check if SMTP is configured
     */
    isConfigured() {
        return !!this.transporter;
    }

    /**
     * Verify SMTP connection
     */
    async verifyConnection() {
        if (!this.transporter) {
            return { valid: false, error: 'SMTP not configured' };
        }

        try {
            await this.transporter.verify();
            return { valid: true };
        } catch (error) {
    console.error("SMTP ERROR:", error);

    return {
        valid: false,
        error: error.message,
        code: error.code,
        command: error.command,
    };
}
    }

    /**
     * Send email
     */
    async sendEmail(to, subject, text, html) {
        if (!this.transporter) {
            return {
                success: false,
                error: 'Email service not configured (SMTP missing)',
            };
        }

        try {
            const info = await this.transporter.sendMail({
                from: this.from,
                to,
                subject,
                text,
                html: html || undefined,
            });

            return {
                success: true,
                messageId: info.messageId,
                status: 'sent',
            };
        } catch (error) {
            console.error(`❌ Email failed to ${to}:`, error.message);

            return {
                success: false,
                error: error.message,
            };
        }
    }
}

module.exports = new EmailService();