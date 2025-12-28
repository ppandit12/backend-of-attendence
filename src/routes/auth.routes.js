const express = require('express');
const router = express.Router();
const { signup, login, me, forgotPassword, verifyOtp, resetPassword } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { 
  signupSchema, 
  loginSchema, 
  forgotPasswordSchema, 
  verifyOtpSchema, 
  resetPasswordSchema, 
  validate 
} = require('../validators/schemas');

// POST /auth/signup
router.post('/signup', validate(signupSchema), signup);

// POST /auth/login
router.post('/login', validate(loginSchema), login);

// POST /auth/forgot-password
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);

// POST /auth/verify-otp
router.post('/verify-otp', validate(verifyOtpSchema), verifyOtp);

// POST /auth/reset-password
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

// GET /auth/me
router.get('/me', authenticate, me);

module.exports = router;
