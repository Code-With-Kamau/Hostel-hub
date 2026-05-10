const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const APP_NAME = 'HostelHub';
const APP_URL  = process.env.APP_URL || 'http://localhost:3000';
const FROM     = `"${APP_NAME}" <${process.env.SMTP_USER}>`;

// ── Verify email ───────────────────────────────────────────────────────────
async function sendVerificationEmail(toEmail, toName, token) {
  const link = `${APP_URL}/verify-email?token=${token}`;
  await transporter.sendMail({
    from:    FROM,
    to:      toEmail,
    subject: `Verify your ${APP_NAME} account`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#f9f9f9;border-radius:8px;">
        <h2 style="color:#6c3ec0;">Welcome to ${APP_NAME}!</h2>
        <p>Hi <strong>${toName}</strong>,</p>
        <p>Thank you for signing up. Please verify your email address to activate your account.</p>
        <a href="${link}" style="display:inline-block;padding:12px 28px;background:#6c3ec0;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;margin:16px 0;">
          Verify My Email
        </a>
        <p style="color:#666;font-size:13px;">This link expires in <strong>24 hours</strong>. If you did not create an account, ignore this email.</p>
        <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;">
        <p style="color:#999;font-size:12px;">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
      </div>`,
  });
}

// ── Forgot password ────────────────────────────────────────────────────────
async function sendPasswordResetEmail(toEmail, toName, token) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  await transporter.sendMail({
    from:    FROM,
    to:      toEmail,
    subject: `Reset your ${APP_NAME} password`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#f9f9f9;border-radius:8px;">
        <h2 style="color:#6c3ec0;">Password Reset Request</h2>
        <p>Hi <strong>${toName}</strong>,</p>
        <p>We received a request to reset your password. Click the button below to set a new password.</p>
        <a href="${link}" style="display:inline-block;padding:12px 28px;background:#6c3ec0;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;margin:16px 0;">
          Reset Password
        </a>
        <p style="color:#666;font-size:13px;">This link expires in <strong>1 hour</strong>. If you did not request a password reset, ignore this email.</p>
        <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;">
        <p style="color:#999;font-size:12px;">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
      </div>`,
  });
}

// ── Booking confirmation ───────────────────────────────────────────────────
async function sendBookingConfirmation(toEmail, toName, hostelName, depositAmount, cancelDeadline) {
  await transporter.sendMail({
    from:    FROM,
    to:      toEmail,
    subject: `Booking Confirmed – ${hostelName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#f9f9f9;border-radius:8px;">
        <h2 style="color:#6c3ec0;">Booking Confirmed! 🎉</h2>
        <p>Hi <strong>${toName}</strong>,</p>
        <p>Your booking for <strong>${hostelName}</strong> has been confirmed.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px;color:#666;">Deposit Paid</td><td style="padding:8px;font-weight:bold;">KES ${Number(depositAmount).toLocaleString()}</td></tr>
          <tr style="background:#f0f0f0;"><td style="padding:8px;color:#666;">Free Cancellation Until</td><td style="padding:8px;font-weight:bold;">${new Date(cancelDeadline).toDateString()}</td></tr>
        </table>
        <p style="color:#666;font-size:13px;">You can cancel your booking within 3 days for a full refund to your M-Pesa.</p>
        <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;">
        <p style="color:#999;font-size:12px;">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
      </div>`,
  });
}

// ── Booking cancelled / refund initiated ──────────────────────────────────
async function sendRefundNotification(toEmail, toName, hostelName, amount) {
  await transporter.sendMail({
    from:    FROM,
    to:      toEmail,
    subject: `Refund Initiated – ${hostelName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#f9f9f9;border-radius:8px;">
        <h2 style="color:#e74c3c;">Booking Cancelled</h2>
        <p>Hi <strong>${toName}</strong>,</p>
        <p>Your booking for <strong>${hostelName}</strong> has been cancelled.</p>
        <p>A refund of <strong>KES ${Number(amount).toLocaleString()}</strong> has been initiated to your M-Pesa and should arrive within 24 hours.</p>
        <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;">
        <p style="color:#999;font-size:12px;">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
      </div>`,
  });
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendBookingConfirmation,
  sendRefundNotification,
};
