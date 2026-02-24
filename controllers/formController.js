const { JoinKalkisenaClinic, FreeCoachingRegistration, HostelRegistration, User } = require('../models');
const { validationResult } = require('express-validator');

/**
 * Join Kalki Sena Clinic
 */
const joinKalkiSena = async (req, res) => {
  console.log('Request body:', req.body);
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors:', errors.array());
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { user_id, full_name, mobile_number, family_members, email } = req.body;

    // Validate required fields
    if (!user_id || !full_name || !mobile_number) {
      return res.status(422).json({
        success: false,
        message: 'Missing required fields',
        errors: [
          !user_id && { msg: 'User ID is required', param: 'user_id' },
          !full_name && { msg: 'Full name is required', param: 'full_name' },
          !mobile_number && { msg: 'Mobile number is required', param: 'mobile_number' }
        ].filter(Boolean)
      });
    }

    // Check if user exists
    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Trim string fields
    const trimmedFullName = full_name.trim();
    const trimmedMobileNumber = mobile_number.trim();
    const trimmedEmail = email ? email.trim() : null;

    if (!trimmedFullName || !trimmedMobileNumber) {
      return res.status(422).json({
        success: false,
        message: 'Required fields cannot be empty after trimming whitespace'
      });
    }

    // Create join kalki sena clinic record with all form data
    const data = await JoinKalkisenaClinic.create({
      user_id: parseInt(user_id),
      full_name: trimmedFullName,
      mobile_number: trimmedMobileNumber,
      family_members: family_members ? parseInt(family_members) : 0,
      email: trimmedEmail || null
    });

    console.log('Successfully created join kalki sena clinic record:', data.toJSON());

    return res.status(201).json({
      success: true,
      message: 'Joined Kalki Sena Clinic successfully.',
      data: data.toJSON()
    });

  } catch (error) {
    console.error('Join Kalki Sena error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error joining Kalki Sena Clinic',
      error: error.message
    });
  }
};

/**
 * Register For Free Coaching
 */
const registerCoaching = async (req, res) => {
  console.log('Request body:', req.body);
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors:', errors.array());
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { user_id, entrance_preparation, coaching_subject } = req.body;

    // Validate required fields are present
    if (!user_id || !entrance_preparation || !coaching_subject) {
      return res.status(422).json({
        success: false,
        message: 'Missing required fields',
        errors: [
          !user_id && { msg: 'User ID is required', param: 'user_id' },
          !entrance_preparation && { msg: 'Entrance preparation is required', param: 'entrance_preparation' },
          !coaching_subject && { msg: 'Coaching subject is required', param: 'coaching_subject' }
        ].filter(Boolean)
      });
    }

    // Check if user exists
    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Trim and validate string fields
    const trimmedEntrancePrep = entrance_preparation.trim();
    const trimmedCoachingSubject = coaching_subject.trim();

    if (!trimmedEntrancePrep || !trimmedCoachingSubject) {
      return res.status(422).json({
        success: false,
        message: 'Fields cannot be empty after trimming whitespace'
      });
    }

    // Create free coaching registration record with all form data
    const data = await FreeCoachingRegistration.create({
      user_id: parseInt(user_id),
      entrance_preparation: trimmedEntrancePrep,
      coaching_subject: trimmedCoachingSubject
    });

    console.log('Successfully created coaching registration:', data.toJSON());

    return res.status(201).json({
      success: true,
      message: 'Free coaching registration successful.',
      data: data.toJSON()
    });

  } catch (error) {
    console.error('Free coaching registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error registering for free coaching',
      error: error.message
    });
  }
};

/**
 * Register For Hostel
 */
const registerHostel = async (req, res) => {
  console.log('Request body:', req.body);
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors:', errors.array());
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { user_id, full_name, mobile_number, email, hostel_location } = req.body;

    // Validate required fields
    if (!user_id || !full_name || !mobile_number || !hostel_location) {
      return res.status(422).json({
        success: false,
        message: 'Missing required fields',
        errors: [
          !user_id && { msg: 'User ID is required', param: 'user_id' },
          !full_name && { msg: 'Full name is required', param: 'full_name' },
          !mobile_number && { msg: 'Mobile number is required', param: 'mobile_number' },
          !hostel_location && { msg: 'Hostel location is required', param: 'hostel_location' }
        ].filter(Boolean)
      });
    }

    // Check if user exists
    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Trim string fields
    const trimmedFullName = full_name.trim();
    const trimmedMobileNumber = mobile_number.trim();
    const trimmedEmail = email ? email.trim() : null;
    const trimmedHostelLocation = hostel_location.trim();

    if (!trimmedFullName || !trimmedMobileNumber || !trimmedHostelLocation) {
      return res.status(422).json({
        success: false,
        message: 'Required fields cannot be empty after trimming whitespace'
      });
    }

    // Create hostel registration record with all form data
    const data = await HostelRegistration.create({
      user_id: parseInt(user_id),
      full_name: trimmedFullName,
      mobile_number: trimmedMobileNumber,
      email: trimmedEmail || null,
      hostel_location: trimmedHostelLocation
    });

    console.log('Successfully created hostel registration record:', data.toJSON());

    return res.status(201).json({
      success: true,
      message: 'Hostel registration successful.',
      data: data.toJSON()
    });

  } catch (error) {
    console.error('Hostel registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error registering for hostel',
      error: error.message
    });
  }
};

module.exports = {
  joinKalkiSena,
  registerCoaching,
  registerHostel
};
