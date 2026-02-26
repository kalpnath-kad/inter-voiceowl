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

Set the MongoDB connection string via environment variable:

```bash
export MONGODB_URI=mongodb://localhost:27017/voiceowl
```

Or create a `.env` file:

```
MONGODB_URI=mongodb://localhost:27017/voiceowl
```

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
  "sessionId": "session-123",
  "language": "en",
  "status": "initiated",
  "metadata": {}
}
```

### 2. Add Event to Session
```http
POST /sessions/:sessionId/events
Content-Type: application/json

{
  "eventId": "event-456",
  "type": "user_speech",
  "payload": { "text": "Hello" },
  "timestamp": "2024-01-01T00:00:00Z"
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
│   └── filters/               # Exception filters
├── sessions/
│   ├── schemas/               # Mongoose schemas
│   ├── dto/                   # Data transfer objects
│   ├── interfaces/            # TypeScript interfaces
│   ├── repositories/          # Data access layer
│   ├── sessions.controller.ts # REST controllers
│   ├── sessions.service.ts    # Business logic
│   └── sessions.module.ts    # Feature module
```

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
