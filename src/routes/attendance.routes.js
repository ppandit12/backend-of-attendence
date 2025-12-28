const express = require('express');
const router = express.Router();
const { startAttendance, getMyAttendance, getClassAttendance } = require('../controllers/attendance.controller');
const { authenticate, requireTeacher, requireStudent } = require('../middleware/auth.middleware');
const { startAttendanceSchema, validate } = require('../validators/schemas');

// POST /attendance/start - Start attendance session (teacher only)
router.post('/start', authenticate, requireTeacher, validate(startAttendanceSchema), startAttendance);

// GET /attendance/class/:classId - Get attendance summary (teacher only)
router.get('/class/:classId', authenticate, requireTeacher, getClassAttendance);

// GET /class/:id/my-attendance - defined in class routes but uses attendance controller
// This is defined in server.js to match the route pattern

module.exports = router;
