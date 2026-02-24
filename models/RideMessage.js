const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const RideMessage = sequelize.define('RideMessage', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    ride_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'rides',
        key: 'id'
      }
    },
    sender_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    receiver_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    read_at: {
      type: DataTypes.DATE,
      allowNull: true
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
    tableName: 'ride_messages',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['ride_id']
      },
      {
        fields: ['sender_id']
      },
      {
        fields: ['receiver_id']
      },
      {
        fields: ['is_read']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  RideMessage.associate = function(models) {
    RideMessage.belongsTo(models.Ride, {
      foreignKey: 'ride_id',
      as: 'ride'
    });
    RideMessage.belongsTo(models.User, {
      foreignKey: 'sender_id',
      as: 'sender'
    });
    RideMessage.belongsTo(models.User, {
      foreignKey: 'receiver_id',
      as: 'receiver'
    });
  };

  return RideMessage;
};
