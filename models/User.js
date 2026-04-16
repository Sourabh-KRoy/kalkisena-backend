const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    google_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    phone: {
      type: DataTypes.STRING(15),
      allowNull: true
    },
    gender: {
      type: DataTypes.ENUM('male', 'female', 'other'),
      allowNull: true
    },
    date_of_birth: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    email_verified_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: true // Allow null for Google OAuth users (validation handled in routes/controller)
    },
    otp: {
      type: DataTypes.STRING(6),
      allowNull: true
    },
    otp_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'OTP expiration timestamp'
    },
    remember_token: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: 'IP address of the user'
    },
    last_login_ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: 'Last login IP address'
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Last login timestamp'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: 'User account status'
    },
    login_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: 'Number of failed login attempts'
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Account locked until timestamp'
    },
    users_type: {
      type: DataTypes.ENUM('driver', 'users', 'admin', 'hotel'),
      allowNull: false,
      defaultValue: 'users',
      comment: 'Type of user: driver, users, admin, or hotel'
    },
    driver_mode: {
      type: DataTypes.ENUM('offline', 'online'),
      allowNull: false,
      defaultValue: 'offline',
      comment: 'Driver presence: offline = not receiving new ride requests'
    },
    driver_available_for_rides: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'When online and true, driver may accept a new pending ride'
    },
    current_latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      comment: 'Last known driver latitude (updated while online)'
    },
    current_longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      comment: 'Last known driver longitude (updated while online)'
    },
    driver_location_updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When current_latitude/current_longitude were last updated'
    },
    profile_image: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Profile image URL stored in S3'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['email'],
        unique: true
      },
      {
        fields: ['google_id'],
        unique: true,
        where: {
          google_id: {
            [sequelize.Sequelize.Op.ne]: null
          }
        }
      }
    ],
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      }
    }
  });

  User.prototype.comparePassword = async function(candidatePassword) {
    if (!this.password) {
      return false;
    }
    return await bcrypt.compare(candidatePassword, this.password);
  };

  User.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    delete values.password;
    delete values.remember_token;
    delete values.otp;
    return values;
  };

  User.associate = function(models) {
    User.hasMany(models.Vehicle, {
      foreignKey: 'user_id',
      as: 'vehicles'
    });
    User.hasMany(models.Ride, {
      foreignKey: 'user_id',
      as: 'userRides'
    });
    User.hasMany(models.Ride, {
      foreignKey: 'driver_id',
      as: 'driverRides'
    });
    User.hasMany(models.RideMessage, {
      foreignKey: 'sender_id',
      as: 'sentMessages'
    });
    User.hasMany(models.RideMessage, {
      foreignKey: 'receiver_id',
      as: 'receivedMessages'
    });
    User.hasMany(models.PurchaseBook, {
      foreignKey: 'user_id',
      as: 'purchases'
    });
    User.hasMany(models.UserAddress, {
      foreignKey: 'user_id',
      as: 'addresses'
    });
  };

  return User;
};
