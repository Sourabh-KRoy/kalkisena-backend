const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FreeCoachingRegistration = sequelize.define('FreeCoachingRegistration', {
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
    entrance_preparation: {
      type: DataTypes.STRING(150),
      allowNull: false
    },
    coaching_subject: {
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
    tableName: 'free_coaching_registration',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['entrance_preparation']
      },
      {
        fields: ['coaching_subject']
      }
    ]
  });

  // Define association with User model
  FreeCoachingRegistration.associate = function(models) {
    FreeCoachingRegistration.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return FreeCoachingRegistration;
};
