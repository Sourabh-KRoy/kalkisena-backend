const multer = require('multer');
const path = require('path');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');

// Configure AWS S3 client
const s3Client = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY
  }
});

const s3Storage = multerS3({
  s3: s3Client,
  bucket: process.env.S3_BUCKET_NAME,
  metadata: function (req, file, cb) {
    cb(null, { fieldName: file.fieldname });
  },
  key: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    // Store in riders folder for rider registration files
    cb(null, 'riders/' + uniqueSuffix + ext);
  },
  contentType: function (req, file, cb) {
    cb(null, file.mimetype);
  },
  cacheControl: 'max-age=31536000'
});

// File filter for allowed types
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, JPG, PNG, and PDF are allowed.'), false);
  }
};

// Configure multer with S3 storage for multiple files
const uploadMultiple = multer({
  storage: s3Storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit per file
  }
});

// Middleware for rider registration file uploads
// Handles all required files: driving_license_front, driving_license_back, vehicle_registration_certificate,
// vehicle_insurance, national_identity_front, national_identity_back, vehicle_photo_front, vehicle_photo_back
const uploadRiderFiles = uploadMultiple.fields([
  { name: 'driving_license_front', maxCount: 1 },
  { name: 'driving_license_back', maxCount: 1 },
  { name: 'vehicle_registration_certificate', maxCount: 1 },
  { name: 'vehicle_insurance', maxCount: 1 },
  { name: 'national_identity_front', maxCount: 1 },
  { name: 'national_identity_back', maxCount: 1 },
  { name: 'vehicle_photo_front', maxCount: 1 },
  { name: 'vehicle_photo_back', maxCount: 1 }
]);

// Middleware wrapper to handle errors
const handleRiderFileUpload = (req, res, next) => {
  uploadRiderFiles(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading
      return res.status(400).json({
        success: false,
        message: err.message
      });
    } else if (err) {
      // An unknown error occurred
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
    // Everything went fine
    next();
  });
};

// Configure multer with S3 storage for single profile image
const profileImageStorage = multerS3({
  s3: s3Client,
  bucket: process.env.S3_BUCKET_NAME,
  metadata: function (req, file, cb) {
    cb(null, { fieldName: file.fieldname });
  },
  key: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    // Store in profiles folder for user profile images
    cb(null, 'profiles/' + uniqueSuffix + ext);
  },
  contentType: function (req, file, cb) {
    cb(null, file.mimetype);
  },
  cacheControl: 'max-age=31536000'
});

// File filter for profile images (only images)
const profileImageFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, JPG, PNG, and WEBP images are allowed.'), false);
  }
};

// Configure multer for single profile image upload
const uploadProfileImage = multer({
  storage: profileImageStorage,
  fileFilter: profileImageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
}).single('profile_image');

// Middleware wrapper for profile image upload
const handleProfileImageUpload = (req, res, next) => {
  uploadProfileImage(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum size is 5MB.'
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message
      });
    } else if (err) {
      // An unknown error occurred
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
    // Everything went fine
    next();
  });
};

// Function to delete a file from S3
const deleteFileFromS3 = async (url) => {
  if (!url) return;
  
  try {
    // Extract the key from the URL
    const urlObj = new URL(url);
    // The key is everything after the bucket name in the path
    const key = urlObj.pathname.substring(1);
    
    const command = new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key
    });
    
    await s3Client.send(command);
    console.log(`Successfully deleted ${key} from S3`);
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    // Don't throw error, as we don't want to fail the request if deletion fails
  }
};

module.exports = {
  handleRiderFileUpload,
  handleProfileImageUpload,
  deleteFileFromS3,
  s3Client
};
