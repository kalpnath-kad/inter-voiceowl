# VoiceOwl Conversation Session Service

A NestJS backend service for managing conversation sessions and events in a Voice AI platform.

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (v5 or higher)
- npm or yarn

## Installation

```bash
npm install
```

## Configuration

Copy the example environment file and configure your variables:

```bash
cp .env.example .env
```

Then edit `.env` with your configuration:

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/voiceowl
MONGODB_MAX_TIME_MS=30000
```

Alternatively, you can set environment variables directly:

```bash
export PORT=3000
export MONGODB_URI=mongodb://localhost:27017/voiceowl
export MONGODB_MAX_TIME_MS=30000
```

### Environment Variables

- **PORT**: Application port (default: 3000)
- **MONGODB_URI**: MongoDB connection string (required)
- **MONGODB_MAX_TIME_MS**: Maximum query execution time in milliseconds (default: 30000 / 30 seconds)

## Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The application will start on `http://localhost:3000`

## API Documentation

Swagger/OpenAPI documentation is available at:
- **Swagger UI**: http://localhost:3000/api
- **JSON Schema**: http://localhost:3000/api-json

The Swagger UI provides interactive API documentation where you can test all endpoints directly from your browser.

## API Endpoints

### 1. Create or Upsert Session
```http
POST /sessions
Content-Type: application/json

{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "language": "en",
  "status": "initiated",
  "metadata": {}
}
```

**Note**: `sessionId` must be a valid UUID format (provided externally).

### 2. Add Event to Session
```http
POST /sessions/:sessionId/events
Content-Type: application/json

{
  "type": "user_speech",
  "payload": { "text": "Hello" }
}
```

**Optional fields**:
- `eventId`: UUID format (if not provided, will be auto-generated)
- `timestamp`: Automatically set to current time (server-side)

**Example with eventId**:
```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440001",
  "type": "user_speech",
  "payload": { "text": "Hello" }
}
```

### 3. Get Session with Events
```http
GET /sessions/:sessionId?limit=50&offset=0
```

### 4. Complete Session
```http
POST /sessions/:sessionId/complete
```

## Project Structure

```
src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
├── common/
│   ├── filters/               # Exception filters
│   ├── interceptors/          # Request/response interceptors
│   └── validators/            # Custom validators (UUID)
├── database/
│   └── mongo.module.ts        # MongoDB connection and configuration
├── sessions/
│   ├── schemas/               # Mongoose schemas
│   ├── dto/                   # Data transfer objects
│   ├── interfaces/            # TypeScript interfaces
│   ├── repositories/          # Data access layer
│   ├── sessions.controller.ts # REST controllers
│   ├── sessions.service.ts    # Business logic
│   └── sessions.module.ts    # Feature module
```

## Features

- **Idempotent Operations**: All endpoints support idempotent requests
- **Request Logging**: All HTTP requests and responses are logged
- **Query Timeout**: MongoDB queries have configurable timeout (default: 30s)
- **Error Handling**: Comprehensive error handling with proper HTTP status codes
- **Graceful Shutdown**: Handles SIGINT/SIGTERM signals for clean shutdown
- **API Documentation**: Interactive Swagger UI for testing endpoints

## Design Decisions

See [DESIGN.md](./DESIGN.md) for detailed answers to design questions.

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```
