const express = require('express');
const router = express.Router();
const { createClass, addStudent, getClass, getMyClasses, getEnrolledClasses } = require('../controllers/class.controller');
const { authenticate, requireTeacher, requireStudent } = require('../middleware/auth.middleware');
const { createClassSchema, addStudentSchema, validate } = require('../validators/schemas');

// GET /class/my-classes - Get teacher's classes (must be before :id route)
router.get('/my-classes', authenticate, requireTeacher, getMyClasses);

// GET /class/enrolled - Get student's enrolled classes (must be before :id route)
router.get('/enrolled', authenticate, requireStudent, getEnrolledClasses);

// POST /class - Create class (teacher only)
router.post('/', authenticate, requireTeacher, validate(createClassSchema), createClass);

// POST /class/:id/add-student - Add student to class (teacher only)
router.post('/:id/add-student', authenticate, requireTeacher, validate(addStudentSchema), addStudent);

// GET /class/:id - Get class details
router.get('/:id', authenticate, getClass);

module.exports = router;

