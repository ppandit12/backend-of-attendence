const express = require('express');
const router = express.Router();
const { signup, login, me } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { signupSchema, loginSchema, validate } = require('../validators/schemas');

// POST /auth/signup
router.post('/signup', validate(signupSchema), signup);

// POST /auth/login
router.post('/login', validate(loginSchema), login);

// GET /auth/me
router.get('/me', authenticate, me);

module.exports = router;
