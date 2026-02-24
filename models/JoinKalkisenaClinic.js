const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const JoinKalkisenaClinic = sequelize.define('JoinKalkisenaClinic', {
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
    family_members: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true
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
    tableName: 'join_kalkisena_clinic',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['email']
      }
    ]
  });

  // Define association with User model
  JoinKalkisenaClinic.associate = function(models) {
    JoinKalkisenaClinic.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return JoinKalkisenaClinic;
};
