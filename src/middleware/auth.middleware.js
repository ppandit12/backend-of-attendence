const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Authenticate JWT token
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized, token missing or invalid'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      role: decoded.role
    };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized, token missing or invalid'
    });
  }
};

// Require teacher role
const requireTeacher = (req, res, next) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden, teacher access required'
    });
  }
  next();
};

// Require student role
const requireStudent = (req, res, next) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden, student access required'
    });
  }
  next();
};

module.exports = {
  authenticate,
  requireTeacher,
  requireStudent
};
