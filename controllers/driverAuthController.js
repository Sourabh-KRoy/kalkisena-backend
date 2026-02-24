const { User, DriverRegistration } = require('../models');
const { validationResult } = require('express-validator');
const { generateToken, getClientIP } = require('../utils/helpers');
const { deleteFileFromS3 } = require('../utils/s3Upload');

/**
 * Driver Login
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

    // Check if user is a driver
    if (user.users_type !== 'driver') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This account is not a driver account.'
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
      message: 'Driver login successful',
      data: {
        user: user.toJSON(),
        token
      }
    });
  } catch (error) {
    console.error('Driver login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
};

/**
 * Get Driver Profile
 */
const getProfile = async (req, res) => {
  try {
    const user = req.user;

    // Verify user is a driver
    if (user.users_type !== 'driver') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This account is not a driver account.'
      });
    }

    res.json({
      success: true,
      data: {
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Get driver profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching driver profile',
      error: error.message
    });
  }
};

/**
 * Rider Registration
 */
const registerRider = async (req, res) => {
  console.log('registerRider', req.body);
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Clean up uploaded files if validation fails
      if (req.files) {
        Object.values(req.files).forEach(fileArray => {
          if (fileArray && fileArray[0] && fileArray[0].location) {
            deleteFileFromS3(fileArray[0].location);
          }
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      name,
      password,
      phone_number,
      dob,
      gender,
      email,
      memberid,
      city_to_ride,
      vehicle_type,
      vehicle_make,
      vehicle_model,
      year_of_manufacture,
      color,
      number_of_seats,
      licence_plate_number
    } = req.body;

    // Check if user already exists with this email
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      // Clean up uploaded files
      if (req.files) {
        Object.values(req.files).forEach(fileArray => {
          if (fileArray && fileArray[0] && fileArray[0].location) {
            deleteFileFromS3(fileArray[0].location);
          }
        });
      }
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists. Please use a different email or login.'
      });
    }

    // Get file URLs from uploaded files
    const files = req.files || {};
    const getFileUrl = (fieldName) => {
      if (files[fieldName] && files[fieldName][0] && files[fieldName][0].location) {
        return files[fieldName][0].location;
      }
      return null;
    };

    // Create a new user account for the rider
    // Password will be automatically hashed by the User model's beforeCreate hook
    const user = await User.create({
      name: name,
      email: email,
      password: password,
      phone: phone_number,
      gender: gender.toLowerCase(),
      date_of_birth: dob,
      users_type: 'driver',
      is_active: false, // Inactive until registration is approved
      email_verified_at: null,
      ip: getClientIP(req)
    });

    // Create driver registration
    const driverRegistration = await DriverRegistration.create({
      user_id: user.id,
      full_name: name,
      date_of_birth: dob,
      gender: gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase(),
      phone_number: phone_number,
      email: email,
      memberid: memberid || null,
      city_to_ride: city_to_ride,
      vehicle_type: vehicle_type,
      make: vehicle_make,
      model: vehicle_model,
      year_of_manufacture: parseInt(year_of_manufacture),
      color: color || null,
      number_of_seats: number_of_seats ? parseInt(number_of_seats) : null,
      licence_plate_number: licence_plate_number || null,
      driving_license_front: getFileUrl('driving_license_front'),
      driving_license_back: getFileUrl('driving_license_back'),
      vehicle_registration_front: getFileUrl('vehicle_registration_certificate'),
      insurance_certificate: getFileUrl('vehicle_insurance'),
      citizenship_front: getFileUrl('national_identity_front'),
      citizenship_back: getFileUrl('national_identity_back'),
      number_plate_front: getFileUrl('vehicle_photo_front'),
      number_plate_back: getFileUrl('vehicle_photo_back'),
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Rider registration submitted successfully. Your registration is pending approval.',
      data: {
        registration: driverRegistration.toJSON()
      }
    });
  } catch (error) {
    console.error('Rider registration error:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      Object.values(req.files).forEach(fileArray => {
        if (fileArray && fileArray[0] && fileArray[0].location) {
          deleteFileFromS3(fileArray[0].location);
        }
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error registering rider',
      error: error.message
    });
  }
};

module.exports = {
  login,
  getProfile,
  registerRider
};
