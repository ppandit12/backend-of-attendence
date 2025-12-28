const { z } = require('zod');

// Auth schemas
const signupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['teacher', 'student'])
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

// Class schemas
const createClassSchema = z.object({
  className: z.string().min(1)
});

const addStudentSchema = z.object({
  studentId: z.string().min(1)
});

// Attendance schemas
const startAttendanceSchema = z.object({
  classId: z.string().min(1)
});

// Validate middleware factory
const validate = (schema) => (req, res, next) => {
  console.log('Validating body:', req.body);
  const result = schema.safeParse(req.body);
  if (!result.success) {
    console.log('Validation error:', result.error);
    return res.status(400).json({
      success: false,
      error: 'Invalid request schema'
    });
  }
  req.validated = result.data;
  next();
};

module.exports = {
  signupSchema,
  loginSchema,
  createClassSchema,
  addStudentSchema,
  startAttendanceSchema,
  validate
};
