const Class = require('../models/Class');
const User = require('../models/User');

// POST /class - Create class (teacher only)
const createClass = async (req, res) => {
  try {
    const { className } = req.validated;

    // Check if class with same name already exists for this teacher
    const existingClass = await Class.findOne({ 
      className, 
      teacherId: req.user.userId 
    });
    if (existingClass) {
      return res.status(400).json({
        success: false,
        error: 'Class with this name already exists'
      });
    }

    const newClass = new Class({
      className,
      teacherId: req.user.userId,
      studentIds: []
    });
    await newClass.save();

    res.status(201).json({
      success: true,
      data: {
        _id: newClass._id,
        className: newClass.className,
        teacherId: newClass.teacherId,
        studentIds: newClass.studentIds
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// POST /class/:id/add-student - Add student to class (teacher only, must own class)
const addStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId } = req.validated;

    const classDoc = await Class.findById(id);
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

    // Check if student exists and is a student
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // Add student if not already enrolled
    if (!classDoc.studentIds.includes(studentId)) {
      classDoc.studentIds.push(studentId);
      await classDoc.save();
    }

    res.json({
      success: true,
      data: {
        _id: classDoc._id,
        className: classDoc.className,
        teacherId: classDoc.teacherId,
        studentIds: classDoc.studentIds
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// GET /class/:id - Get class details
const getClass = async (req, res) => {
  try {
    const { id } = req.params;

    const classDoc = await Class.findById(id).populate('studentIds', '_id name email');
    if (!classDoc) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }

    // Check access: teacher who owns OR student enrolled
    const isTeacher = classDoc.teacherId.toString() === req.user.userId;
    const isEnrolledStudent = classDoc.studentIds.some(
      s => s._id.toString() === req.user.userId
    );

    if (!isTeacher && !isEnrolledStudent) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden, not class teacher'
      });
    }

    res.json({
      success: true,
      data: {
        _id: classDoc._id,
        className: classDoc.className,
        teacherId: classDoc.teacherId,
        students: classDoc.studentIds.map(s => ({
          _id: s._id,
          name: s.name,
          email: s.email
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// GET /students - Get all students (teacher only)
const getStudents = async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }).select('_id name email');

    res.json({
      success: true,
      data: students.map(s => ({
        _id: s._id,
        name: s.name,
        email: s.email
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// GET /class/my-classes - Get all classes created by this teacher
const getMyClasses = async (req, res) => {
  try {
    const Attendance = require('../models/Attendance');
    const classes = await Class.find({ teacherId: req.user.userId });

    // Check attendance records for each class
    const classesWithAttendance = await Promise.all(classes.map(async (c) => {
      const attendanceCount = await Attendance.countDocuments({ classId: c._id });
      return {
        _id: c._id,
        className: c.className,
        teacherId: c.teacherId,
        studentIds: c.studentIds,
        studentCount: c.studentIds.length,
        createdAt: c.createdAt,
        hasAttendance: attendanceCount > 0
      };
    }));

    res.json({
      success: true,
      data: classesWithAttendance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// GET /class/enrolled - Get all classes this student is enrolled in
const getEnrolledClasses = async (req, res) => {
  try {
    const classes = await Class.find({ studentIds: req.user.userId });

    res.json({
      success: true,
      data: classes.map(c => ({
        _id: c._id,
        className: c.className
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = { createClass, addStudent, getClass, getStudents, getMyClasses, getEnrolledClasses };

