const Class = require('../models/Class');
const Attendance = require('../models/Attendance');

// In-memory active session state
let activeSession = null;

// Get active session (exported for WebSocket)
const getActiveSession = () => activeSession;
const setActiveSession = (session) => { activeSession = session; };
const clearActiveSession = () => { activeSession = null; };

// POST /attendance/start - Start attendance session (teacher only)
const startAttendance = async (req, res) => {
  try {
    const { classId } = req.validated;

    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    // Check if teacher owns the class
    if (classDoc.teacherId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden, not class teacher'
      });
    }

    // Start new session
    activeSession = {
      classId: classId,
      startedAt: new Date().toISOString(),
      attendance: {}
    };

    res.json({
      success: true,
      data: {
        classId: activeSession.classId,
        startedAt: activeSession.startedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// GET /class/:id/my-attendance - Get student's own attendance (student only, enrolled)
const getMyAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    const classDoc = await Class.findById(id);
    if (!classDoc) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    // Check if student is enrolled
    const isEnrolled = classDoc.studentIds.some(
      s => s.toString() === req.user.userId
    );

    if (!isEnrolled) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden, not enrolled in class'
      });
    }

    // Check MongoDB for persisted attendance
    const attendance = await Attendance.findOne({
      classId: id,
      studentId: req.user.userId
    });

    res.json({
      success: true,
      data: {
        classId: id,
        status: attendance ? attendance.status : null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// GET /attendance/class/:classId - Get attendance summary for a class (teacher only)
const getClassAttendance = async (req, res) => {
  try {
    const { classId } = req.params;
    const Class = require('../models/Class');
    const Attendance = require('../models/Attendance');
    const User = require('../models/User');

    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    // Check if teacher owns the class
    if (classDoc.teacherId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden, not class teacher'
      });
    }

    // Get all attendance records for this class with student info
    const records = await Attendance.find({ classId }).populate('studentId', 'name email');

    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;

    res.json({
      success: true,
      data: {
        classId,
        className: classDoc.className,
        records: records.map(r => ({
          studentId: r.studentId._id,
          studentName: r.studentId.name,
          studentEmail: r.studentId.email,
          status: r.status
        })),
        summary: { present, absent, total: present + absent }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  startAttendance,
  getMyAttendance,
  getClassAttendance,
  getActiveSession,
  setActiveSession,
  clearActiveSession
};
