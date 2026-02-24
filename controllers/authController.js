const { User } = require('../models');
const { validationResult } = require('express-validator');
const { generateToken, getClientIP, generateOTP } = require('../utils/helpers');
const { sendOTPEmail } = require('../utils/email');
const { OAuth2Client } = require('google-auth-library');
const { Op } = require('sequelize');

/**
 * Register a new user
 */
const register = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, email, password, phone, gender, date_of_birth, google_id, users_type } = req.body;
    const clientIP = getClientIP(req);

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Check if google_id is provided and already exists
    if (google_id) {
      const existingGoogleUser = await User.findOne({ where: { google_id } });
      if (existingGoogleUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this Google ID already exists'
        });
      }
    }

    // Validate: password is required if google_id is not provided
    if (!google_id && !password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required for registration'
      });
    }

    // Generate 6-digit OTP
    const otp = generateOTP(6);
    
    // OTP expires in 10 minutes
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Create new user (inactive until OTP is verified)
    const user = await User.create({
      name,
      email,
      password: password || null, // Allow null for Google OAuth users
      phone,
      gender,
      date_of_birth,
      google_id,
      users_type: users_type || 'users', // Default to 'users' if not provided
      ip: clientIP,
      otp,
      otp_expires_at: otpExpiresAt,
      is_active: false // Not active until email is verified
    });

    // Send OTP email
    try {
      await sendOTPEmail(email, otp, name);
    } catch (emailError) {
      console.error('Error sending OTP email:', emailError);
      // Still return success, but log the error
      // In production, you might want to handle this differently
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful. OTP sent to your email address. Please verify your email to activate your account.',
      data: {
        email: user.email
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
};

/**
 * Login user
 */
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;
    const clientIP = getClientIP(req);

    // Find user by email
    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is locked
    if (user.locked_until && new Date() < user.locked_until) {
      return res.status(423).json({
        success: false,
        message: 'Account is locked. Please try again later.'
      });
    }

    // Check if account is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive'
      });
    }

    // Verify password (skip for Google OAuth users without password)
    if (!user.password && user.google_id) {
      return res.status(400).json({
        success: false,
        message: 'Please login using Google OAuth'
      });
    }

    if (password && !(await user.comparePassword(password))) {
      // Increment login attempts
      user.login_attempts += 1;
      
      // Lock account after 5 failed attempts for 30 minutes
      if (user.login_attempts >= 5) {
        user.locked_until = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      }
      
      await user.save();

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        remaining_attempts: Math.max(0, 5 - user.login_attempts)
      });
    }

    // Reset login attempts on successful login
    user.login_attempts = 0;
    user.locked_until = null;
    user.last_login_ip = clientIP;
    user.last_login_at = new Date();

    // Generate token
    const token = generateToken(user.id);
    user.remember_token = token;
    await user.save();

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toJSON(),
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
};

/**
 * Logout user
 */
const logout = async (req, res) => {
  try {
    const user = req.user;

    // Clear remember_token
    user.remember_token = null;
    await user.save();

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging out',
      error: error.message
    });
  }
};

/**
 * Get user profile
 */
const getProfile = async (req, res) => {
  try {
    const user = req.user;

    res.json({
      success: true,
      data: {
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message
    });
  }
};

/**
 * Update user profile
 */
const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const user = req.user;
    const { name, phone, gender, date_of_birth, users_type } = req.body;

    // Update allowed fields
    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (gender !== undefined) user.gender = gender;
    if (date_of_birth !== undefined) user.date_of_birth = date_of_birth;
    if (users_type !== undefined) user.users_type = users_type;

    // Handle profile image upload
    if (req.file) {
      const { deleteFileFromS3 } = require('../utils/s3Upload');
      
      // Delete old profile image from S3 if it exists
      if (user.profile_image) {
        await deleteFileFromS3(user.profile_image);
      }
      
      // Update with new profile image URL
      user.profile_image = req.file.location; // S3 file URL
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
};

/**
 * Verify registration OTP
 */
const verifyRegistrationOtp = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Format errors in Laravel-style for 422 status
      const formattedErrors = {};
      errors.array().forEach(error => {
        const field = error.path || error.param;
        if (!formattedErrors[field]) {
          formattedErrors[field] = [];
        }
        formattedErrors[field].push(error.msg);
      });

      return res.status(422).json({
        success: false,
        message: 'The given data was invalid.',
        errors: formattedErrors
      });
    }

    const { email, otp } = req.body;

    // Find user by email
    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      return res.status(422).json({
        success: false,
        message: 'Invalid OTP. Please try again.',
        errors: {
          otp: ['Invalid OTP. Please request a new OTP.']
        }
      });
    }

    // Check if OTP exists
    if (!user.otp) {
      return res.status(422).json({
        success: false,
        message: 'Invalid OTP. Please request a new OTP.',
        errors: {
          otp: ['No OTP found. Please request a new OTP.']
        }
      });
    }

    // Check if OTP has expired
    if (user.otp_expires_at && new Date() > new Date(user.otp_expires_at)) {
      // Clear expired OTP
      user.otp = null;
      user.otp_expires_at = null;
      await user.save();

      return res.status(422).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP.',
        errors: {
          otp: ['OTP has expired. Please request a new OTP.']
        }
      });
    }

    // Verify OTP
    if (user.otp !== otp) {
      return res.status(422).json({
        success: false,
        message: 'Invalid OTP. Please try again.',
        errors: {
          otp: ['Invalid OTP. Please try again.']
        }
      });
    }

    // OTP is valid - mark email as verified and clear OTP
    user.email_verified_at = new Date();
    user.otp = null;
    user.otp_expires_at = null;
    user.is_active = true; // Activate user after email verification
    await user.save();

    // Generate token for the verified user
    const token = generateToken(user.id);
    user.remember_token = token;
    await user.save();

    res.json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        user: user.toJSON(),
        token
      }
    });
  } catch (error) {
    console.error('Verify registration OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying OTP',
      error: error.message
    });
  }
};

/**
 * Google OAuth Login/Signup
 */
const googleAuth = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id_token } = req.body;
    const clientIP = getClientIP(req);

    // Initialize Google OAuth client
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    // Verify the ID token
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (error) {
      console.error('Google token verification error:', error);
      return res.status(401).json({
        success: false,
        message: 'Invalid Google ID token'
      });
    }

    const payload = ticket.getPayload();
    const { sub: google_id, email, name, picture, email_verified } = payload;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email not provided by Google'
      });
    }

    // Check if user exists by email or google_id
    let user = await User.findOne({
      where: {
        [Op.or]: [
          { email },
          { google_id }
        ]
      }
    });

    if (user) {
      // User exists - update Google ID if not set, and login
      if (!user.google_id) {
        user.google_id = google_id;
      }
      
      // Update user info from Google if needed
      if (name && user.name !== name) {
        user.name = name;
      }
      
      // Mark email as verified if Google says it's verified
      if (email_verified && !user.email_verified_at) {
        user.email_verified_at = new Date();
      }

      user.last_login_ip = clientIP;
      user.last_login_at = new Date();
      user.login_attempts = 0;
      user.locked_until = null;
      user.is_active = true;

      // Generate token
      const token = generateToken(user.id);
      user.remember_token = token;
      await user.save();

      return res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: user.toJSON(),
          token,
          is_new_user: false
        }
      });
    } else {
      // New user - create account
      user = await User.create({
        google_id,
        name: name || email.split('@')[0],
        email,
        password: null, // No password for Google OAuth users
        email_verified_at: email_verified ? new Date() : null,
        ip: clientIP,
        is_active: true,
        users_type: 'users' // Default user type
      });

      // Generate token
      const token = generateToken(user.id);
      user.remember_token = token;
      await user.save();

      return res.status(201).json({
        success: true,
        message: 'Account created and logged in successfully',
        data: {
          user: user.toJSON(),
          token,
          is_new_user: true
        }
      });
    }
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Error authenticating with Google',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  verifyRegistrationOtp,
  googleAuth
};
