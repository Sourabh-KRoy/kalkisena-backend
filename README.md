# Kalkisena Node.js API

A Node.js REST API built with Express, Sequelize ORM, and PostgreSQL.

## Features

- User registration and authentication
- JWT-based authentication
- User profile management
- Password hashing with bcrypt
- Input validation
- Account locking after failed login attempts
- IP tracking for security
- Google OAuth support ready

## Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Sequelize** - ORM for PostgreSQL
- **PostgreSQL** - Database
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing
- **express-validator** - Input validation

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Update the `.env` file with your database credentials and JWT secret

5. Run migrations to create the database tables:
```bash
npm run migrate
```

6. Start the development server:
```bash
npm run dev
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user (requires authentication)
- `GET /api/auth/profile` - Get user profile (requires authentication)
- `PUT /api/auth/profile` - Update user profile (requires authentication)

### Health Check

- `GET /health` - Check server status

## Example Requests

### Register
```bash
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "phone": "+1234567890",
  "gender": "male",
  "date_of_birth": "1990-01-01"
}
```

### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

### Get Profile (requires Bearer token)
```bash
GET /api/auth/profile
Authorization: Bearer <your-token>
```

### Update Profile (requires Bearer token)
```bash
PUT /api/auth/profile
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "name": "Jane Doe",
  "phone": "+9876543210",
  "gender": "female"
}
```

## Database Schema

The `users` table includes:
- Basic user information (name, email, phone, gender, date_of_birth)
- Authentication fields (password, google_id, otp, remember_token)
- Security fields (ip, last_login_ip, last_login_at, login_attempts, locked_until)
- Timestamps (created_at, updated_at, email_verified_at)
- Account status (is_active)

## Security Features

- Password hashing with bcrypt
- JWT token-based authentication
- Account locking after 5 failed login attempts
- IP address tracking
- Input validation
- CORS and Helmet for security headers

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Run migrations
npm run migrate

# Undo last migration
npm run migrate:undo
```

## Production

Make sure to:
1. Set `NODE_ENV=production`
2. Use a strong `JWT_SECRET`
3. Configure proper database credentials
4. Set up HTTPS
5. Configure CORS properly
