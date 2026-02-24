const { RideMessage, Ride, User } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

const sendMessage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { ride_id, message } = req.body;

    const ride = await Ride.findByPk(ride_id);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    const isUser = ride.user_id === userId;
    const isDriver = ride.driver_id === userId;

    if (!isUser && !isDriver) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to send messages for this ride'
      });
    }

    if (ride.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot send messages for cancelled rides'
      });
    }

    let receiverId;
    if (isUser) {
      if (!ride.driver_id) {
        return res.status(400).json({
          success: false,
          message: 'Ride has not been accepted by a driver yet'
        });
      }
      receiverId = ride.driver_id;
    } else {
      receiverId = ride.user_id;
    }

    const rideMessage = await RideMessage.create({
      ride_id,
      sender_id: userId,
      receiver_id: receiverId,
      message: message.trim()
    });

    const messageWithDetails = await RideMessage.findByPk(rideMessage.id, {
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'name', 'email', 'phone']
        },
        {
          model: User,
          as: 'receiver',
          attributes: ['id', 'name', 'email', 'phone']
        },
        {
          model: Ride,
          as: 'ride',
          attributes: ['id', 'status']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        message: messageWithDetails
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending message',
      error: error.message
    });
  }
};

const getRideMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { ride_id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const ride = await Ride.findByPk(ride_id);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    const isUser = ride.user_id === userId;
    const isDriver = ride.driver_id === userId;

    if (!isUser && !isDriver) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view messages for this ride'
      });
    }

    const messages = await RideMessage.findAndCountAll({
      where: {
        ride_id
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'name', 'email', 'phone']
        },
        {
          model: User,
          as: 'receiver',
          attributes: ['id', 'name', 'email', 'phone']
        }
      ],
      order: [['created_at', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    await RideMessage.update(
      {
        is_read: true,
        read_at: new Date()
      },
      {
        where: {
          ride_id,
          receiver_id: userId,
          is_read: false
        }
      }
    );

    res.json({
      success: true,
      data: {
        messages: messages.rows,
        total: messages.count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get ride messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching messages',
      error: error.message
    });
  }
};

const markMessagesAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { ride_id } = req.body;

    const ride = await Ride.findByPk(ride_id);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    const isUser = ride.user_id === userId;
    const isDriver = ride.driver_id === userId;

    if (!isUser && !isDriver) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to mark messages for this ride'
      });
    }

    const updated = await RideMessage.update(
      {
        is_read: true,
        read_at: new Date()
      },
      {
        where: {
          ride_id,
          receiver_id: userId,
          is_read: false
        }
      }
    );

    res.json({
      success: true,
      message: 'Messages marked as read',
      data: {
        updated_count: updated[0]
      }
    });
  } catch (error) {
    console.error('Mark messages as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking messages as read',
      error: error.message
    });
  }
};

const getUnreadMessageCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const userRides = await Ride.findAll({
      where: {
        user_id: userId
      },
      attributes: ['id']
    });

    const driverRides = await Ride.findAll({
      where: {
        driver_id: userId
      },
      attributes: ['id']
    });

    const allRideIds = [
      ...userRides.map(r => r.id),
      ...driverRides.map(r => r.id)
    ];

    if (allRideIds.length === 0) {
      return res.json({
        success: true,
        data: {
          unread_count: 0
        }
      });
    }

    const unreadCount = await RideMessage.count({
      where: {
        ride_id: {
          [Op.in]: allRideIds
        },
        receiver_id: userId,
        is_read: false
      }
    });

    res.json({
      success: true,
      data: {
        unread_count: unreadCount
      }
    });
  } catch (error) {
    console.error('Get unread message count error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching unread message count',
      error: error.message
    });
  }
};

module.exports = {
  sendMessage,
  getRideMessages,
  markMessagesAsRead,
  getUnreadMessageCount
};
