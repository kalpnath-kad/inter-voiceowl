# Design Decisions

## 1. How did you ensure idempotency?

Idempotency is ensured through multiple mechanisms:

### Session Creation (POST /sessions)
- **Atomic Upsert Operation**: Uses MongoDB's `findOneAndUpdate` with `upsert: true` and `$setOnInsert` operator. This ensures that:
  - If a session with the given `sessionId` exists, it returns the existing session without modification
  - If it doesn't exist, it creates a new one atomically
  - Concurrent requests are handled safely at the database level
- **Unique Index**: The `sessionId` field has a unique index, preventing duplicate sessions even under race conditions

### Event Creation (POST /sessions/:sessionId/events)
- **Compound Unique Index**: A compound unique index on `(sessionId, eventId)` ensures that each `eventId` is unique per session
- **Atomic Upsert**: Similar to session creation, uses `findOneAndUpdate` with `upsert: true` and `$setOnInsert`
- **Immutability**: Once created, events cannot be modified, ensuring idempotent behavior - duplicate requests return the existing event

### Session Completion (POST /sessions/:sessionId/complete)
- **Status Check**: Before updating, checks if the session is already completed
- **Idempotent Update**: If already completed, returns the session as-is without modification
- **Atomic Update**: Uses `findOneAndUpdate` for atomic status updates

## 2. How does your design behave under concurrent requests?

The design handles concurrent requests safely through:

### Database-Level Atomicity
- **Unique Constraints**: MongoDB unique indexes provide database-level enforcement, preventing race conditions
- **Atomic Operations**: `findOneAndUpdate` with `upsert` is atomic at the database level, eliminating race conditions between check-and-insert operations
- **$setOnInsert**: This operator ensures that fields are only set on insert, not on update, preserving existing data

### Example Scenarios:

**Concurrent Session Creation:**
- Two requests with the same `sessionId` arrive simultaneously
- Both attempt `findOneAndUpdate` with upsert
- MongoDB ensures only one insert succeeds; the other returns the newly created session
- Both clients receive the same session (idempotent)

**Concurrent Event Creation:**
- Two requests with the same `(sessionId, eventId)` arrive simultaneously
- The compound unique index ensures only one insert succeeds
- The other request either gets the existing event (if upsert returns it) or catches the duplicate key error and fetches the existing event
- Both clients receive the same event (idempotent)

**Concurrent Session Completion:**
- Multiple requests to complete the same session
- Each request checks status and updates atomically
- If already completed, returns existing state
- If not completed, the first update wins, subsequent requests see it as completed

## 3. What MongoDB indexes did you choose and why?

### ConversationSession Collection:

1. **`sessionId` (unique, single field)**
   - **Purpose**: Primary lookup key, ensures uniqueness
   - **Usage**: All session queries use `sessionId`
   - **Why**: Fast O(log n) lookups, prevents duplicates

2. **`status` (single field)**
   - **Purpose**: Filter sessions by status
   - **Usage**: Queries filtering by status (e.g., find all active sessions)
   - **Why**: Common query pattern for monitoring and analytics

3. **`language` (single field)**
   - **Purpose**: Filter sessions by language
   - **Usage**: Language-specific queries and analytics
   - **Why**: Common filtering requirement

4. **`{ status: 1, startedAt: -1 }` (compound)**
   - **Purpose**: Efficient queries for sessions by status, ordered by start time
   - **Usage**: "Get all active sessions sorted by most recent"
   - **Why**: Supports common operational queries (monitoring, dashboards)

5. **`{ language: 1, startedAt: -1 }` (compound)**
   - **Purpose**: Efficient queries for sessions by language, ordered by start time
   - **Usage**: Language-specific analytics and reporting
   - **Why**: Supports analytics queries

### ConversationEvent Collection:

1. **`sessionId` (single field)**
   - **Purpose**: Primary lookup key for events
   - **Usage**: All event queries filter by `sessionId`
   - **Why**: Essential for retrieving events for a session

2. **`type` (single field)**
   - **Purpose**: Filter events by type
   - **Usage**: Queries filtering by event type (e.g., all user_speech events)
   - **Why**: Common analytics requirement

3. **`timestamp` (single field)**
   - **Purpose**: Order events chronologically
   - **Usage**: Sorting events by time
   - **Why**: Required for chronological ordering

4. **`{ sessionId: 1, eventId: 1 }` (compound, unique)**
   - **Purpose**: Ensures eventId uniqueness per session, enables fast lookups
   - **Usage**: Idempotency checks, duplicate prevention
   - **Why**: Critical for data integrity and idempotency

5. **`{ sessionId: 1, timestamp: 1 }` (compound)**
   - **Purpose**: Efficient retrieval of events for a session, ordered by timestamp
   - **Usage**: GET /sessions/:sessionId endpoint (paginated event retrieval)
   - **Why**: Optimizes the most common query pattern - fetching events for a session in chronological order

### Index Strategy Rationale:
- **Single-field indexes** on frequently queried fields enable fast filtering
- **Compound indexes** support common query patterns (filter + sort)
- **Unique indexes** enforce data integrity and enable idempotency
- **Index order matters**: For compound indexes, equality filters come first, then sort fields

## 4. How would you scale this system for millions of sessions per day?

### Database Scaling:

1. **MongoDB Sharding**
   - Shard by `sessionId` (hash-based or range-based)
   - Distributes load across multiple shards
   - Each shard handles a subset of sessions

2. **Read Replicas**
   - Deploy read replicas for GET operations
   - Separate read and write traffic
   - Scale reads horizontally

3. **Index Optimization**
   - Monitor slow queries and adjust indexes
   - Consider partial indexes for common filters (e.g., only index active sessions)
   - Remove unused indexes to reduce write overhead

4. **Connection Pooling**
   - Use connection pooling to manage database connections efficiently
   - Configure appropriate pool sizes based on load

### Application Scaling:

1. **Horizontal Scaling**
   - Stateless application design allows horizontal scaling
   - Deploy multiple instances behind a load balancer
   - Use round-robin or least-connections load balancing

2. **Caching Strategy**
   - **Redis Cache**: Cache frequently accessed sessions and recent events
   - Cache TTL: Short TTL (e.g., 5-10 minutes) for active sessions
   - Cache invalidation: Invalidate on writes (session updates, new events)
   - Cache key: `session:{sessionId}` and `session:{sessionId}:events:{page}`

3. **Event Streaming**
   - For high-volume event ingestion, consider:
     - Kafka/RabbitMQ for event buffering
     - Batch inserts instead of individual inserts
     - Async processing for non-critical operations

4. **Pagination Optimization**
   - Use cursor-based pagination instead of offset-based for large datasets
   - Reduces database load on deep pagination
   - Example: `?cursor={timestamp}&limit=50`

### Data Management:

1. **Data Archival**
   - Archive old completed sessions to cold storage (S3, Glacier)
   - Keep recent sessions (e.g., last 90 days) in hot storage
   - Implement tiered storage strategy

2. **TTL Indexes**
   - Consider TTL indexes for temporary data if applicable
   - Auto-delete old events after retention period

3. **Partitioning**
   - Partition events by date (e.g., monthly collections)
   - Reduces collection size and improves query performance
   - Requires application-level routing logic

### Monitoring & Observability:

1. **Metrics**
   - Track request rates, latency, error rates
   - Database query performance metrics
   - Cache hit rates

2. **Alerting**
   - Set up alerts for high error rates, slow queries, connection pool exhaustion
   - Monitor database replication lag

3. **Load Testing**
   - Regular load testing to identify bottlenecks
   - Capacity planning based on growth projections

### Estimated Capacity:
- **1 million sessions/day** ≈ **11.6 sessions/second** (average)
- With proper sharding, caching, and horizontal scaling, the system can handle:
  - **Peak load**: 100-1000+ requests/second per endpoint
  - **Sustained load**: 50-500+ requests/second per endpoint
- Actual capacity depends on:
  - Average events per session
  - Read/write ratio
  - Hardware specifications
  - Network latency

## 5. What did you intentionally keep out of scope, and why?

### Authentication & Authorization
- **Why**: Assignment focuses on core business logic, not security infrastructure
- **Production Need**: Would require JWT/OAuth, role-based access control, API keys

### Rate Limiting
- **Why**: Not specified in requirements, adds complexity
- **Production Need**: Would prevent abuse, ensure fair resource usage

### Webhooks/Event Notifications
- **Why**: Not in requirements, adds external dependencies
- **Production Need**: Would notify external systems of session/event changes

### Event Validation & Schema Enforcement
- **Why**: Kept payload as generic object for flexibility
- **Production Need**: Would validate event payloads against schemas (e.g., JSON Schema)

### Soft Deletes
- **Why**: Requirements specify immutable events, no deletion mentioned
- **Production Need**: Would allow data recovery and audit trails

### Audit Logging
- **Why**: Not in requirements, adds storage overhead
- **Production Need**: Would track who created/modified what and when

### Metrics & Analytics Endpoints
- **Why**: Focus on core CRUD operations
- **Production Need**: Would provide aggregated statistics (sessions by status, events by type, etc.)

### WebSocket/Real-time Updates
- **Why**: Requirements specify REST API only
- **Production Need**: Would enable real-time event streaming to clients

### Event Replay/Versioning
- **Why**: Requirements specify immutable events, no versioning needed
- **Production Need**: Would allow event schema evolution and replay capabilities

### Multi-tenancy
- **Why**: Not in requirements, adds complexity
- **Production Need**: Would isolate data per tenant/organization

### Transaction Support
- **Why**: MongoDB transactions add overhead; atomic operations sufficient for requirements
- **Production Need**: Would ensure ACID guarantees across multiple operations

### Comprehensive Error Handling
- **Why**: Basic error handling implemented; production would need more granular error codes
- **Production Need**: Would provide detailed error messages, retry logic, dead letter queues

### Testing
- **Why**: Assignment focuses on implementation; tests would be essential in production
- **Production Need**: Unit tests, integration tests, E2E tests, load tests

### Documentation (API Docs)
- **Why**: Code is self-documenting; production would need OpenAPI/Swagger
- **Production Need**: Would provide interactive API documentation

### Deployment Configuration
- **Why**: Assignment focuses on code; production needs Docker, K8s configs, CI/CD
- **Production Need**: Would include Dockerfile, docker-compose, Helm charts, deployment scripts
