# Social Platform Backend Documentation

## Overview

This backend system powers a social platform with features for content sharing, user interactions, feed generation, and analytics. The system is built with scalability, real-time updates, and performance optimization in mind.

## Technology Stack

- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL with DrizzleORM
- **Caching**: Redis
- **Message Queue**: Kafka
- **File Storage**: Cloudinary
- **Authentication**: Clerk
- **Analytics**: Custom implementation

## Core Components

### 1. Authentication System (`/backend/routes/auth.routes.ts`, `/backend/middlewares/auth.middleware.ts`)

- Clerk-based authentication
- User session management
- Protected route middleware
- Webhook handling for user events

### 2. Feed System

#### Core Feed Generation (`/backend/services/feed.service.ts`)

- Personalized feed generation with weighted content mixing
- Content diversity management
- Source weighting (FOLLOWED: 0.35, SPECIALIZATION: 0.35, TRENDING: 0.2, DISCOVERY: 0.1)
- Feed weights (FOLLOWED_USERS: 0.9, SPECIALIZATION: 10, POPULAR_POSTS: 0.2, RANDOM_DISCOVERY: 0.1)
- Post scoring based on recency, engagement, relevance, author popularity, and view completion
- Differential updates with configurable limits
- Cache integration with Redis

#### Feed Analytics (`/backend/services/feed.analytics.service.ts`)

- Impression tracking
- View duration tracking
- Scroll depth analysis
- Refresh rate monitoring
- Prefetch hit rate analysis
- Content type performance metrics
- Completion rate tracking
- Bounce rate analysis

#### Feed Optimization (`/backend/services/feed.optimization.service.ts`)

- Content mix optimization
- Weight-based content distribution
- Engagement-based adjustments
- Time-based content weighting
- Performance tuning
- Cache warming strategies

### 3. Content Management

#### Content Diversity (`/backend/services/content_diversity.service.ts`)

- Content type weighting:
  - RESEARCH_PAPER: 0.35
  - NEWS_UPDATE: 0.25
  - DISCUSSION: 0.2
  - ANNOUNCEMENT: 0.15
  - OTHER: 0.05
- Time window weighting:
  - LAST_24H: 0.5
  - LAST_WEEK: 0.3
  - LAST_MONTH: 0.2
- Source diversity management
- Pagination handling

#### Post Management (`/backend/services/post.service.ts`)

- Post CRUD operations
- Media handling with Cloudinary
- Content validation
- Engagement tracking
- Transaction management
- Cache invalidation
- Event emission

#### Position Tracking (`/backend/services/position_tracking.service.ts`)

- Feed position saving
- Cross-device position restoration
- Scroll offset management
- Viewport tracking
- Device-specific adjustments

### 4. Performance Optimization

#### Caching (`/backend/services/redis.service.ts`)

- Multi-level caching strategy
- Feed caching (5-minute expiry)
- Post caching (24-hour expiry)
- Popular content caching
- Cache warming for hot feeds
- Batch operations
- Cache invalidation
- Performance monitoring

#### Prefetching (`/backend/services/prefetch.service.ts`)

- Content prefetching
- State management
- Threshold-based triggers (70% viewed content)
- Batch size management (20 items)
- Specialization-based prefetching
- Trending content prefetching
- Cleanup mechanisms

#### View State (`/backend/services/view_state.service.ts`)

- View tracking with device context
- Interaction logging
- View duration tracking
- Scroll position monitoring
- Cache-first approach
- 24-hour state retention
- Analytics integration

### 5. Event System (`/backend/services/event.producer.ts`, `/backend/services/event.consumer.ts`)

#### Event Producer

- Kafka message production
- Event type management:
  - Post events (created, updated, deleted, liked)
  - User events (followed, unfollowed)
  - Feed events (updated, invalidated)
  - Fanout events (regular, popular)
- Error handling
- Connection management

#### Event Consumer

- Event processing
- State updates
- Cache invalidation
- Analytics updates
- Error recovery
- Message handling

### 6. AI Integration (`/backend/services/ai.service.ts`)

- Google Gemini AI integration
- Post categorization
- Content analysis
- Specialization matching
- Automated tagging

### 7. Monitoring (`/backend/services/monitoring.service.ts`)

- Performance metrics tracking
- Slow query detection (>500ms)
- Memory usage monitoring
- Cache hit rate tracking
- Error rate monitoring
- System health checks

## Data Flow

### 1. Feed Generation Flow

1. User requests feed
2. Authentication check
3. Cache check
   - If cached: Return cached feed
   - If not cached:
     a. Generate personalized feed
     b. Apply content diversity
     c. Cache results
4. Track analytics
5. Return response

### 2. Post Creation Flow

1. User creates post
2. Media upload (if any)
3. Content validation
4. Database transaction
5. Cache invalidation
6. Event production
7. Analytics update

### 3. User Interaction Flow

1. User interaction received
2. Authentication verification
3. State update
4. Cache modification
5. Event production
6. Analytics logging

## Error Handling

- Development vs Production errors
- Custom error responses
- Logging and monitoring
- Recovery mechanisms

## Performance Optimizations

1. Multi-level caching
2. Content prefetching
3. Cache warming
4. Database indexing
5. Query optimization
6. Connection pooling

## Security Measures

1. Authentication middleware
2. Input validation
3. Rate limiting
4. CORS configuration
5. Error sanitization
6. Secure headers

## Monitoring and Analytics

1. Performance metrics
2. User engagement
3. Error tracking
4. Cache hit rates
5. API latency
6. Resource utilization

## Configuration Management

- Environment-based configs
- Feature flags
- Service configurations
- Security settings

## File Structure Explanation

### `/backend/controllers/`

- **feed.controller.ts**: Handles feed-related requests
- **image.controller.ts**: Manages image uploads and retrieval
- **post.controller.ts**: Handles post-related operations
- **webhook.controller.ts**: Processes external webhooks

### `/backend/services/`

- **feed.service.ts**: Core feed generation logic
- **redis.service.ts**: Caching operations
- **content_diversity.service.ts**: Content mixing algorithms
- **monitoring.service.ts**: System monitoring
- **position_tracking.service.ts**: User interaction tracking
- **feed.analytics.service.ts**: Feed performance analytics
- **post.service.ts**: Post management
- **view_state.service.ts**: View tracking
- **prefetch.service.ts**: Content prefetching

### `/backend/routes/`

- **auth.routes.ts**: Authentication endpoints
- **feed.routes.ts**: Feed endpoints
- **feed.optimization.routes.ts**: Feed tuning endpoints
- **feed.analytics.routes.ts**: Analytics endpoints
- **follow.routes.ts**: Follow system endpoints
- **specialization.routes.ts**: User specialization endpoints
- **view_state.routes.ts**: View tracking endpoints
- **image.routes.ts**: Image management endpoints

### `/backend/middlewares/`

- **auth.middleware.ts**: Authentication checks
- **errorHandler.ts**: Error processing
- **multer.middleware.ts**: File upload handling
- **specialization.middleware.ts**: Specialization validation

### `/backend/models/schema/`

- **post.schema.ts**: Post data structure
- **like.schema.ts**: Like data structure
- Other schema definitions

## Best Practices

1. Consistent error handling
2. Type safety
3. Dependency injection
4. Service isolation
5. Caching strategies
6. Event-driven architecture
7. Performance monitoring
8. Security measures

## Development Guidelines

1. Code style consistency
2. Error handling patterns
3. Testing requirements
4. Documentation standards
5. Performance considerations
6. Security best practices

## Deployment Considerations

1. Environment configuration
2. Database migrations
3. Cache warming
4. Monitoring setup
5. Backup strategies
6. Scaling policies

## Future Improvements

1. Enhanced caching strategies
2. Advanced analytics
3. Machine learning integration
4. Performance optimizations
5. Additional features
6. Scaling capabilities

## Database Schema

### Users Table

- id: Primary key
- clerk_id: String (Clerk user identifier)
- username: String
- email: String
- created_at: Timestamp
- updated_at: Timestamp
- onboarded: Boolean
- profile_image_url: String (nullable)

### Posts Table

- id: Primary key
- user_id: Foreign key (Users)
- content: Text
- created_at: Timestamp
- updated_at: Timestamp
- deleted_at: Timestamp (nullable)
- media_urls: String[] (nullable)

### Specializations Table

- id: Primary key
- name: String
- description: Text (nullable)
- created_at: Timestamp

### UserSpecializations Table

- id: Primary key
- user_id: Foreign key (Users)
- specialization_id: Foreign key (Specializations)
- created_at: Timestamp

### Likes Table

- id: Primary key
- user_id: Foreign key (Users)
- post_id: Foreign key (Posts)
- created_at: Timestamp

### Follows Table

- id: Primary key
- follower_id: Foreign key (Users)
- following_id: Foreign key (Users)
- created_at: Timestamp

### Images Table

- id: Primary key
- user_id: Foreign key (Users)
- cloudinary_id: String
- url: String
- created_at: Timestamp

### ViewStates Table

- id: Primary key
- user_id: Foreign key (Users)
- post_id: Foreign key (Posts)
- position: Integer
- viewed_at: Timestamp
- interaction_type: String

## API Endpoints

### Authentication (`/api/auth`)

- GET /api/auth/all-users - Get all users (requires auth)
- GET /api/auth/current-user - Get current user (requires auth)

### Feed (`/api/feed`)

- GET /api/feed - Get personalized feed
- GET /api/feed/polling-interval - Get feed polling interval
- GET /api/feed/updates - Get differential updates

### Feed Analytics (`/api/feed-analytics`)

- POST /api/feed-analytics/impression - Track feed impression
- POST /api/feed-analytics/view - Track feed view
- POST /api/feed-analytics/scroll - Track scroll depth
- POST /api/feed-analytics/refresh - Track feed refresh
- POST /api/feed-analytics/prefetch-hit - Track prefetch hit/miss
- GET /api/feed-analytics/metrics - Get feed metrics
- GET /api/feed-analytics/content-metrics - Get content type metrics
- DELETE /api/feed-analytics/cleanup - Cleanup analytics

### Feed Optimization (`/api/feed-optimization`)

- POST /api/feed-optimization/content - Get optimized content mix
- GET /api/feed-optimization/refresh-interval - Get optimal refresh interval
- GET /api/feed-optimization/prefetch-threshold - Get optimal prefetch threshold

### Posts (`/api/posts`)

- POST /api/posts/create-post - Create new post (supports up to 5 media files)
- GET /api/posts/user - Get current user's posts
- GET /api/posts/:postId - Get specific post
- PUT /api/posts/:postId - Update post
- DELETE /api/posts/:postId - Delete post

### Specializations (`/api/specializations`)

- GET /api/specializations - Get all specializations
- GET /api/specializations/user - Get user specializations (requires onboarding)
- POST /api/specializations/user/onboarding - Complete specialization onboarding
- PUT /api/specializations/user - Update specializations (requires onboarding)

### Follow System (`/api/follow`)

- POST /api/follow/:userId/follow - Follow user
- POST /api/follow/:userId/unfollow - Unfollow user

### View State (`/api/view-state`)

- POST /api/view-state/:postId/view - Track post view
- GET /api/view-state/:postId - Get view state
- POST /api/view-state/:postId/interaction - Track interaction

### Position Tracking (`/api/position-tracking`)

- POST /api/position-tracking - Save feed position
- GET /api/position-tracking - Get feed position
- DELETE /api/position-tracking - Clear feed position
- GET /api/position-tracking/posts - Get posts around position
- PATCH /api/position-tracking - Update feed position

### Prefetch (`/api/prefetch`)

- POST /api/prefetch/init - Initialize prefetch state
- GET /api/prefetch/state - Get prefetch state
- POST /api/prefetch/trigger - Trigger next batch prefetch
- POST /api/prefetch/specialization - Prefetch specialization content
- POST /api/prefetch/trending - Prefetch trending content
- DELETE /api/prefetch/cleanup - Cleanup prefetched content

## Environment Variables

```env
# App Configuration
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Redis
REDIS_URL=redis://localhost:6379

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=social-platform

# Clerk
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Monitoring
SENTRY_DSN=your_sentry_dsn
```
