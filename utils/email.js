const nodemailer = require('nodemailer');

/**
 * Create email transporter
 */
const createTransporter = () => {
  // Use credentials from env.example as defaults
  const smtpUser = process.env.SMTP_USER || 'aryanmandal800@gmail.com';
  const smtpPassword = process.env.SMTP_PASSWORD || 'wytk keht pxoz geud';
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpSecure = process.env.SMTP_SECURE === 'true' || false;

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure, // true for 465, false for other ports
    auth: {
      user: smtpUser.trim(),
      pass: smtpPassword.trim(),
    },
  });
};

/**
 * Send OTP email
 */
const sendOTPEmail = async (email, otp, name = 'User') => {
  try {
    const transporter = createTransporter();
    
    // Use credentials from env.example as defaults
    const smtpUser = process.env.SMTP_USER || 'aryanmandal800@gmail.com';
    const appName = process.env.APP_NAME || 'Kalkisena';

    const mailOptions = {
      from: `"${appName}" <${smtpUser}>`,
      to: email,
      subject: 'Email Verification OTP - Kalkisena',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification OTP</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
            <h2 style="color: #333; margin-top: 0;">Email Verification</h2>
            <p>Hello ${name},</p>
            <p>Thank you for registering with Kalkisena. Please use the following OTP to verify your email address:</p>
            <div style="background-color: #fff; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px; border: 2px dashed #ddd;">
              <h1 style="color: #007bff; font-size: 36px; letter-spacing: 5px; margin: 0;">${otp}</h1>
            </div>
            <p>This OTP will expire in 10 minutes.</p>
            <p>If you didn't request this verification, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="font-size: 12px; color: #666;">This is an automated email. Please do not reply to this message.</p>
          </div>
        </body>
        </html>
      `,
      text: `
        Email Verification OTP
        
        Hello ${name},
        
        Thank you for registering with Kalkisena. Please use the following OTP to verify your email address:
        
        OTP: ${otp}
        
        This OTP will expire in 10 minutes.
        
        If you didn't request this verification, please ignore this email.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

module.exports = {
  sendOTPEmail,
  createTransporter
};
