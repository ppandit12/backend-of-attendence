# Live Attendance System - Backend

Node.js backend with Express, MongoDB, and WebSocket for real-time attendance tracking.

## Features

- JWT Authentication (Teacher/Student roles)
- Class Management (CRUD)
- Real-time Attendance via WebSocket
- MongoDB for persistence

## Setup

```bash
npm install
cp .env.example .env  # Add your MongoDB URI and JWT secret
npm run dev
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for JWT signing

## API Endpoints

- `POST /auth/signup` - Register user
- `POST /auth/login` - Login
- `GET /auth/me` - Get current user
- `POST /class` - Create class (teacher)
- `GET /class/my-classes` - Get teacher's classes
- `POST /attendance/start` - Start attendance session
- `WebSocket /ws` - Real-time attendance events
