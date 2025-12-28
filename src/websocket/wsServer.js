const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const url = require('url');
const Class = require('../models/Class');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const { getActiveSession, setActiveSession, clearActiveSession } = require('../controllers/attendance.controller');

// Store all connected clients
const clients = new Set();

// Store pending join requests: { classId: [{ studentId, studentName, studentEmail }] }
let pendingJoinRequests = {};

const setupWebSocket = (server) => {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    // Extract token from query params
    const query = url.parse(req.url, true).query;
    const token = query.token;

    if (!token) {
      ws.send(JSON.stringify({
        event: 'ERROR',
        data: { message: 'Unauthorized or invalid token' }
      }));
      ws.close();
      return;
    }

    // Verify JWT
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      ws.user = {
        userId: decoded.userId,
        role: decoded.role
      };
      clients.add(ws);
      
      // Send current session info on connect
      const activeSession = getActiveSession();
      if (activeSession) {
        ws.send(JSON.stringify({
          event: 'SESSION_INFO',
          data: {
            active: true,
            classId: activeSession.classId,
            startedAt: activeSession.startedAt
          }
        }));
      } else {
        ws.send(JSON.stringify({
          event: 'SESSION_INFO',
          data: { active: false }
        }));
      }
    } catch (error) {
      ws.send(JSON.stringify({
        event: 'ERROR',
        data: { message: 'Unauthorized or invalid token' }
      }));
      ws.close();
      return;
    }

    // Handle incoming messages
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        const { event } = message;

        switch (event) {
          case 'ATTENDANCE_MARKED':
            await handleAttendanceMarked(ws, message.data);
            break;
          case 'TODAY_SUMMARY':
            await handleTodaySummary(ws);
            break;
          case 'MY_ATTENDANCE':
            await handleMyAttendance(ws);
            break;
          case 'DONE':
            await handleDone(ws);
            break;
          case 'JOIN_REQUEST':
            await handleJoinRequest(ws, message.data);
            break;
          case 'APPROVE_JOIN':
            await handleApproveJoin(ws, message.data);
            break;
          case 'REJECT_JOIN':
            await handleRejectJoin(ws, message.data);
            break;
          case 'GET_PENDING_REQUESTS':
            await handleGetPendingRequests(ws);
            break;
          case 'GET_MY_CLASSES':
            await handleGetMyClasses(ws);
            break;
          default:
            ws.send(JSON.stringify({
              event: 'ERROR',
              data: { message: 'Unknown event' }
            }));
        }
      } catch (error) {
        ws.send(JSON.stringify({
          event: 'ERROR',
          data: { message: 'Invalid message format' }
        }));
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  return wss;
};

// Broadcast to all connected clients
const broadcast = (message) => {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(data);
    }
  });
};

// Send to specific user by userId
const sendToUser = (userId, message) => {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === 1 && client.user.userId === userId) {
      client.send(data);
    }
  });
};

// Send to all teachers
const sendToTeachers = (message) => {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === 1 && client.user.role === 'teacher') {
      client.send(data);
    }
  });
};

// Event: JOIN_REQUEST (Student only)
const handleJoinRequest = async (ws, data) => {
  if (ws.user.role !== 'student') {
    ws.send(JSON.stringify({
      event: 'ERROR',
      data: { message: 'Forbidden, student event only' }
    }));
    return;
  }

  const activeSession = getActiveSession();
  if (!activeSession) {
    ws.send(JSON.stringify({
      event: 'ERROR',
      data: { message: 'No active attendance session' }
    }));
    return;
  }

  // Get student info
  const student = await User.findById(ws.user.userId);
  if (!student) {
    ws.send(JSON.stringify({
      event: 'ERROR',
      data: { message: 'Student not found' }
    }));
    return;
  }

  // Check if already enrolled
  const classDoc = await Class.findById(activeSession.classId);
  if (classDoc.studentIds.includes(ws.user.userId)) {
    ws.send(JSON.stringify({
      event: 'JOIN_RESPONSE',
      data: { status: 'already_enrolled', classId: activeSession.classId }
    }));
    return;
  }

  // Add to pending requests
  if (!pendingJoinRequests[activeSession.classId]) {
    pendingJoinRequests[activeSession.classId] = [];
  }
  
  // Check if already requested
  const alreadyRequested = pendingJoinRequests[activeSession.classId].some(
    r => r.studentId === ws.user.userId
  );
  
  if (!alreadyRequested) {
    pendingJoinRequests[activeSession.classId].push({
      studentId: ws.user.userId,
      studentName: student.name,
      studentEmail: student.email
    });
  }

  // Notify student
  ws.send(JSON.stringify({
    event: 'JOIN_RESPONSE',
    data: { status: 'pending', classId: activeSession.classId }
  }));

  // Notify all teachers about new request
  sendToTeachers({
    event: 'NEW_JOIN_REQUEST',
    data: {
      classId: activeSession.classId,
      student: {
        _id: ws.user.userId,
        name: student.name,
        email: student.email
      }
    }
  });
};

// Event: APPROVE_JOIN (Teacher only)
const handleApproveJoin = async (ws, data) => {
  if (ws.user.role !== 'teacher') {
    ws.send(JSON.stringify({
      event: 'ERROR',
      data: { message: 'Forbidden, teacher event only' }
    }));
    return;
  }

  const { studentId } = data;
  const activeSession = getActiveSession();
  
  if (!activeSession) {
    ws.send(JSON.stringify({
      event: 'ERROR',
      data: { message: 'No active attendance session' }
    }));
    return;
  }

  // Add student to class in database
  const classDoc = await Class.findById(activeSession.classId);
  if (!classDoc.studentIds.includes(studentId)) {
    classDoc.studentIds.push(studentId);
    await classDoc.save();
  }

  // Remove from pending requests
  if (pendingJoinRequests[activeSession.classId]) {
    pendingJoinRequests[activeSession.classId] = pendingJoinRequests[activeSession.classId]
      .filter(r => r.studentId !== studentId);
  }

  // Notify student
  sendToUser(studentId, {
    event: 'JOIN_APPROVED',
    data: {
      classId: activeSession.classId,
      className: classDoc.className
    }
  });

  // Notify teacher
  ws.send(JSON.stringify({
    event: 'STUDENT_ADDED',
    data: { studentId, classId: activeSession.classId }
  }));
};

// Event: REJECT_JOIN (Teacher only)
const handleRejectJoin = async (ws, data) => {
  if (ws.user.role !== 'teacher') {
    ws.send(JSON.stringify({
      event: 'ERROR',
      data: { message: 'Forbidden, teacher event only' }
    }));
    return;
  }

  const { studentId } = data;
  const activeSession = getActiveSession();
  
  if (!activeSession) {
    ws.send(JSON.stringify({
      event: 'ERROR',
      data: { message: 'No active attendance session' }
    }));
    return;
  }

  // Remove from pending requests
  if (pendingJoinRequests[activeSession.classId]) {
    pendingJoinRequests[activeSession.classId] = pendingJoinRequests[activeSession.classId]
      .filter(r => r.studentId !== studentId);
  }

  // Notify student
  sendToUser(studentId, {
    event: 'JOIN_REJECTED',
    data: { classId: activeSession.classId }
  });
};

// Event: GET_PENDING_REQUESTS (Teacher only)
const handleGetPendingRequests = async (ws) => {
  if (ws.user.role !== 'teacher') {
    ws.send(JSON.stringify({
      event: 'ERROR',
      data: { message: 'Forbidden, teacher event only' }
    }));
    return;
  }

  const activeSession = getActiveSession();
  const requests = activeSession ? (pendingJoinRequests[activeSession.classId] || []) : [];

  ws.send(JSON.stringify({
    event: 'PENDING_REQUESTS',
    data: { requests }
  }));
};

// Event: GET_MY_CLASSES (Student only)
const handleGetMyClasses = async (ws) => {
  if (ws.user.role !== 'student') {
    ws.send(JSON.stringify({
      event: 'ERROR',
      data: { message: 'Forbidden, student event only' }
    }));
    return;
  }

  const classes = await Class.find({ studentIds: ws.user.userId }).select('_id className');
  
  ws.send(JSON.stringify({
    event: 'MY_CLASSES',
    data: { classes }
  }));
};

// Event: ATTENDANCE_MARKED (Teacher only)
const handleAttendanceMarked = async (ws, data) => {
  if (ws.user.role !== 'teacher') {
    ws.send(JSON.stringify({
      event: 'ERROR',
      data: { message: 'Forbidden, teacher event only' }
    }));
    return;
  }

  const activeSession = getActiveSession();
  if (!activeSession) {
    ws.send(JSON.stringify({
      event: 'ERROR',
      data: { message: 'No active attendance session' }
    }));
    return;
  }

  const { studentId, status } = data;
  
  // Update in-memory state
  activeSession.attendance[studentId] = status;
  setActiveSession(activeSession);

  // Broadcast to all
  broadcast({
    event: 'ATTENDANCE_MARKED',
    data: { studentId, status }
  });
};

// Event: TODAY_SUMMARY (Teacher only)
const handleTodaySummary = async (ws) => {
  if (ws.user.role !== 'teacher') {
    ws.send(JSON.stringify({
      event: 'ERROR',
      data: { message: 'Forbidden, teacher event only' }
    }));
    return;
  }

  const activeSession = getActiveSession();
  if (!activeSession) {
    ws.send(JSON.stringify({
      event: 'ERROR',
      data: { message: 'No active attendance session' }
    }));
    return;
  }

  const attendance = Object.values(activeSession.attendance);
  const present = attendance.filter(s => s === 'present').length;
  const absent = attendance.filter(s => s === 'absent').length;
  const total = attendance.length;

  broadcast({
    event: 'TODAY_SUMMARY',
    data: { present, absent, total }
  });
};

// Event: MY_ATTENDANCE (Student only - unicast)
const handleMyAttendance = async (ws) => {
  if (ws.user.role !== 'student') {
    ws.send(JSON.stringify({
      event: 'ERROR',
      data: { message: 'Forbidden, student event only' }
    }));
    return;
  }

  const activeSession = getActiveSession();
  if (!activeSession) {
    ws.send(JSON.stringify({
      event: 'ERROR',
      data: { message: 'No active attendance session' }
    }));
    return;
  }

  const status = activeSession.attendance[ws.user.userId] || 'not yet updated';

  ws.send(JSON.stringify({
    event: 'MY_ATTENDANCE',
    data: { status }
  }));
};

// Event: DONE (Teacher only)
const handleDone = async (ws) => {
  if (ws.user.role !== 'teacher') {
    ws.send(JSON.stringify({
      event: 'ERROR',
      data: { message: 'Forbidden, teacher event only' }
    }));
    return;
  }

  const activeSession = getActiveSession();
  if (!activeSession) {
    ws.send(JSON.stringify({
      event: 'ERROR',
      data: { message: 'No active attendance session' }
    }));
    return;
  }

  try {
    const classDoc = await Class.findById(activeSession.classId);
    if (!classDoc) {
      ws.send(JSON.stringify({
        event: 'ERROR',
        data: { message: 'Class not found' }
      }));
      return;
    }

    // Mark absent for students not in attendance
    classDoc.studentIds.forEach(studentId => {
      const idStr = studentId.toString();
      if (!activeSession.attendance[idStr]) {
        activeSession.attendance[idStr] = 'absent';
      }
    });

    // Persist to MongoDB
    const attendanceRecords = Object.entries(activeSession.attendance).map(([studentId, status]) => ({
      classId: activeSession.classId,
      studentId,
      status
    }));

    for (const record of attendanceRecords) {
      await Attendance.findOneAndUpdate(
        { classId: record.classId, studentId: record.studentId },
        record,
        { upsert: true, new: true }
      );
    }

    const present = Object.values(activeSession.attendance).filter(s => s === 'present').length;
    const absent = Object.values(activeSession.attendance).filter(s => s === 'absent').length;
    const total = present + absent;

    // Clear pending requests for this class
    delete pendingJoinRequests[activeSession.classId];
    
    clearActiveSession();

    broadcast({
      event: 'DONE',
      data: {
        message: 'Attendance persisted',
        present,
        absent,
        total
      }
    });
  } catch (error) {
    ws.send(JSON.stringify({
      event: 'ERROR',
      data: { message: error.message }
    }));
  }
};

module.exports = { setupWebSocket };
