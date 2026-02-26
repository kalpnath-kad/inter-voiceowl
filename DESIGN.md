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
- **Optional eventId**: The `eventId` can be provided externally (must be valid UUID format) or will be auto-generated if not provided
- **Idempotency with provided eventId**: If `eventId` is provided and an event with the same `(sessionId, eventId)` already exists, the unique constraint will prevent duplicate creation, allowing the client to handle idempotency
- **Auto-generated eventId**: If `eventId` is not provided, a UUID is auto-generated, ensuring each request creates a new unique event
- **Auto-generated timestamp**: The `timestamp` is automatically set to the current date/time when the event is created

### Session Completion (POST /sessions/:sessionId/complete)
- **Status Check**: Before updating, checks if the session is already completed
- **Idempotent Update**: If already completed, returns the session as-is without modification
- **Atomic Update**: Uses `findOneAndUpdate` for atomic status updates

### Query Timeout Protection
- **Global maxTimeMS**: All MongoDB queries have a maximum execution time (default: 30 seconds)
- **Prevents Long-Running Queries**: Queries exceeding the timeout are automatically cancelled
- **Configurable**: Timeout can be adjusted via `MONGODB_MAX_TIME_MS` environment variable
- **Applied Globally**: Mongoose plugin ensures all query operations respect the timeout
- **Per-Query Override**: Individual queries can still set their own `maxTimeMS` if needed

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
- **With provided eventId**: Two requests with the same `(sessionId, eventId)` arrive simultaneously
  - The compound unique index ensures only one insert succeeds
  - The other request will receive a duplicate key error (MongoDB error code 11000)
  - The application can handle this by fetching the existing event, ensuring idempotent behavior
- **Without eventId (auto-generated)**: Each request generates a unique UUID, so concurrent requests will create different events (as intended)
- **Timestamp**: Automatically set server-side, ensuring consistency and preventing timestamp manipulation

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
   - **Format**: Must be a valid UUID (provided externally)
   - **Why**: Fast O(log n) lookups, prevents duplicates, UUID format ensures global uniqueness

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
   - **Usage**: Idempotency checks when eventId is provided externally, duplicate prevention
   - **Format**: eventId is UUID format (can be provided externally or auto-generated)
   - **Why**: Critical for data integrity and idempotency when eventId is provided by the client

5. **`{ sessionId: 1, timestamp: 1 }` (compound)**
   - **Purpose**: Efficient retrieval of events for a session, ordered by timestamp
   - **Usage**: GET /sessions/:sessionId endpoint (paginated event retrieval)
   - **Why**: Optimizes the most common query pattern - fetching events for a session in chronological order

### Index Strategy Rationale:

#### ESR (Equality, Sort, Range) Rule
MongoDB compound indexes follow the **ESR (Equality, Sort, Range)** rule for optimal query performance:

1. **Equality (E)**: Fields used with exact matches (`$eq`, `$in` with small arrays) should come first
2. **Sort (S)**: Fields used for sorting should come after equality fields
3. **Range (R)**: Fields used with range queries (`$gt`, `$lt`, `$gte`, `$lte`, `$ne`, `$nin`) should come last

**Why ESR matters:**
- MongoDB can use an index most efficiently when fields are ordered E → S → R
- Equality filters narrow down the result set first
- Sort fields can use the index for sorting without an in-memory sort
- Range fields can still use the index but are less selective
- Violating ESR can cause index inefficiency or force in-memory sorts

**Examples from our indexes:**

1. **`{ sessionId: 1, timestamp: 1 }`** (ConversationEvent)
   - **E**: `sessionId` (equality filter: `sessionId = 'xxx'`)
   - **S**: `timestamp` (sort: `sort({ timestamp: 1 })`)
   - **Usage**: `find({ sessionId: 'xxx' }).sort({ timestamp: 1 })` - Perfect ESR match

2. **`{ status: 1, startedAt: -1 }`** (ConversationSession)
   - **E**: `status` (equality filter: `status = 'active'`)
   - **S**: `startedAt` (sort: `sort({ startedAt: -1 })`)
   - **Usage**: `find({ status: 'active' }).sort({ startedAt: -1 })` - Perfect ESR match

3. **`{ sessionId: 1, eventId: 1 }`** (ConversationEvent, unique)
   - **E**: `sessionId` (equality filter)
   - **E**: `eventId` (equality filter for uniqueness check)
   - **Usage**: Both fields used for exact matching - optimal for uniqueness constraint

#### General Principles:
- **Single-field indexes** on frequently queried fields enable fast filtering
- **Compound indexes** support common query patterns (filter + sort) following ESR rule
- **Unique indexes** enforce data integrity and enable idempotency
- **Index order matters**: Following ESR ensures optimal query performance

## 4. How would you scale this system for millions of sessions per day?

### Database Scaling:

1. **MongoDB Sharding**
   - **Shard Key**: Use `sessionId` as the shard key for both `conversationsessions` and `conversationevents` collections
   - **Sharding Strategy**: Hash-based sharding is recommended for UUID `sessionId` values to ensure even distribution across shards
   - **Co-location**: Sharding both collections by `sessionId` ensures that sessions and their events are stored on the same shard, enabling efficient queries without cross-shard operations
   - **Benefits**: 
     - Queries for a session and its events only need to hit one shard
     - Even distribution of load across shards (UUIDs are random)
     - Scales horizontally as data grows

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

5. **Query Timeout (maxTimeMS)**
   - Global `maxTimeMS` plugin applied to all MongoDB queries
   - Default timeout: 30 seconds (configurable via `MONGODB_MAX_TIME_MS` environment variable)
   - Prevents long-running queries from blocking the application
   - Applied to all query operations: find, findOne, update, delete, countDocuments, aggregate
   - Per-query overrides are supported if needed

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
- **Note**: Basic validation implemented - `eventId` must be valid UUID format if provided (otherwise auto-generated), `timestamp` is auto-generated server-side

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
- **Why**: Basic Swagger/OpenAPI documentation is implemented
- **Production Need**: Could be enhanced with more detailed examples, authentication flows, rate limiting documentation

### Deployment Configuration
- **Why**: Assignment focuses on code; production needs Docker, K8s configs, CI/CD
- **Production Need**: Would include Dockerfile, docker-compose, Helm charts, deployment scripts

### Advanced MongoDB Configuration
- **Why**: Basic MongoDB connection and query timeout configuration is implemented
- **Production Need**: Could add read preferences, connection pool tuning, replica set configuration, monitoring hooks
- **Note**: Current implementation includes:
  - Global maxTimeMS plugin for query timeouts
  - Connection event logging
  - Graceful shutdown handling
  - Debug mode for non-production environments
