const nodemailer = require('nodemailer');

/**
 * Email delivery via Nodemailer (SMTP).
 * Configure with SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM in .env
 */
class EmailService {
    constructor() {
        this.from = process.env.EMAIL_FROM || 'AnxAware Alerts <alerts@anxaware.app>';
        this.transporter = null;
        this._init();
    }

    _init() {
        const host = process.env.SMTP_HOST;
        const port = parseInt(process.env.SMTP_PORT || '587', 10);
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;

        if (!host || !user || !pass) {
            console.warn('⚠️  Email: SMTP not fully configured (SMTP_HOST, SMTP_USER, SMTP_PASS required)');
            return;
        }

        this.transporter = nodemailer.createTransport({
            host,
            port,
            secure: process.env.SMTP_SECURE === 'true' || port === 465,
            auth: { user, pass },
        });

        console.log('──────────────────────────────────────');
        console.log('📧 Email Service Initialization');
        console.log('──────────────────────────────────────');
        console.log(`   SMTP Host:  ${host}:${port}`);
        console.log(`   From:       ${this.from}`);
        console.log('──────────────────────────────────────');
    }

    isConfigured() {
        return !!this.transporter;
    }

    async verifyConnection() {
        if (!this.transporter) {
            return { valid: false, error: 'SMTP not configured' };
        }
        try {
            await this.transporter.verify();
            return { valid: true };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * @param {string} to - Recipient email
     * @param {string} subject
     * @param {string} text - Plain text body
     * @param {string} [html] - Optional HTML body
     */
    async sendEmail(to, subject, text, html) {
        if (!this.transporter) {
            return {
                success: false,
                error: 'Email service not configured. Set SMTP_* variables in backend .env',
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
            console.error(`   ❌ Email to ${to} failed:`, error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }
}

module.exports = new EmailService();
