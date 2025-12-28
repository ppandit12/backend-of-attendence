require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const connectDB = require('./config/db');
const { setupWebSocket } = require('./websocket/wsServer');

// Import routes
const authRoutes = require('./routes/auth.routes');
const classRoutes = require('./routes/class.routes');
const attendanceRoutes = require('./routes/attendance.routes');

// Import controllers for additional routes
const { getMyAttendance } = require('./controllers/attendance.controller');
const { authenticate, requireStudent } = require('./middleware/auth.middleware');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Health check route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Attendance System API is running!',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/auth', authRoutes);
app.use('/class', classRoutes);
app.use('/attendance', attendanceRoutes);

// GET /students route (teacher only) - separate from /class routes
const { getStudents } = require('./controllers/class.controller');
const { requireTeacher } = require('./middleware/auth.middleware');
app.get('/students', authenticate, requireTeacher, getStudents);

// GET /class/:id/my-attendance (student only, enrolled)
app.get('/class/:id/my-attendance', authenticate, requireStudent, getMyAttendance);

// Setup WebSocket
setupWebSocket(server);

// Connect to MongoDB and start server
const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket available at ws://localhost:${PORT}/ws`);
  });
});
