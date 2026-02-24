const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const HostelRegistration = sequelize.define('HostelRegistration', {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    full_name: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    mobile_number: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true
    },
    hostel_location: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'hostel_registration',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['email']
      },
      {
        fields: ['hostel_location']
      }
    ]
  });

  // Define association with User model
  HostelRegistration.associate = function(models) {
    HostelRegistration.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return HostelRegistration;
};
