# nanoBanana API Research Documentation

**Date**: 2025-09-06  
**Author**: Stream A - API Research and Client Setup  
**Purpose**: Foundation research for Issue #9 nanoBanana API Integration  

## Overview

nanoBanana is the nickname for Google's **Gemini 2.5 Flash Image**, their state-of-the-art image generation and editing model. It provides high-quality, low-latency multimodal image generation and editing capabilities specifically designed for character creation and consistency.

## Core Capabilities

### Image Generation Types
- **Text-to-Image**: Generate images from simple or complex text descriptions
- **Image + Text-to-Image**: Edit existing images by adding, removing, or modifying elements
- **Multi-Image to Image**: Compose multiple images into a single cohesive image
- **Character Consistency**: Maintain character appearance across multiple generations
- **Localized Edits**: Target specific areas without modifying other parts

### Character Creation Features
- Rich storytelling with consistent character appearance
- Blend multiple character concepts into single images
- Natural language transformations for character modifications
- Support for complex character specifications and traits

## API Access Options

### 1. Official Google API
- **Endpoint**: Google AI Studio / Vertex AI
- **Model Name**: `gemini-2.5-flash-image-preview`
- **Pricing**: $30.00 per 1 million output tokens (1290 tokens per image = $0.039/image)
- **Best For**: Enterprise applications, production-grade reliability

### 2. Third-Party Providers
- **NanoBananaAPI.ai**: $0.020 per image (50% cost reduction)
- **fal.ai**: Alternative pricing models
- **Kie.ai**: Affordable integration options
- **Best For**: Development, prototyping, cost-sensitive applications

## Authentication & Security

### API Key Authentication
```http
Authorization: Bearer YOUR_API_KEY
```

### Key Management Requirements
- Secure storage of API keys
- Token rotation capabilities
- Environment-based configuration
- Rate limiting to prevent quota violations

### OAuth 2.0 (Enterprise)
- Available for enterprise applications
- Enhanced security for production deployments
- Service account integration

## API Structure & Endpoints

### Base URL Patterns
- **Official**: `https://ai.googleapis.com/v1/models/gemini-2.5-flash-image:generateContent`
- **Third-party**: `https://api.nanobanana.ai/v1/generate`

### Request Formats

#### Text-to-Image Generation
```json
{
  "model": "gemini-2.5-flash-image-preview",
  "prompt": "character description",
  "parameters": {
    "quality": "high",
    "aspect_ratio": "1:1",
    "style": "realistic",
    "output_format": "png"
  }
}
```

#### Image-to-Image Editing
```json
{
  "model": "gemini-2.5-flash-image-preview",
  "prompt": "modification description",
  "input_image": "base64_encoded_image",
  "parameters": {
    "strength": 0.8,
    "quality": "high"
  }
}
```

### Response Format
```json
{
  "id": "task_id_12345",
  "status": "completed|processing|failed",
  "result": {
    "image_url": "https://storage.url/image.png",
    "image_data": "base64_encoded_result",
    "metadata": {
      "dimensions": "1024x1024",
      "format": "png",
      "generation_time": "2.3s"
    }
  },
  "error": null
}
```

## Rate Limits & Quotas

### Standard Limits
- **Requests per minute**: 60 (varies by provider)
- **Concurrent requests**: 4-10 (optimal batch size: 4)
- **Daily quotas**: Provider-dependent
- **Image size limits**: Typically 2048x2048 max

### Rate Limiting Strategy
- Implement exponential backoff for rate limit errors
- Circuit breaker pattern for API failures
- Queue system for batch processing (up to 4 characters)
- Request throttling to stay under limits

## Error Handling

### Common Error Codes
- **400 Bad Request**: Invalid parameters or prompt
- **401 Unauthorized**: Invalid or expired API key
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Provider-side issues
- **503 Service Unavailable**: Temporary outage

### Retry Strategy
- **Exponential backoff**: 1s, 2s, 4s, 8s, 16s intervals
- **Max retries**: 5 attempts for transient errors
- **Circuit breaker**: Open circuit after 5 consecutive failures
- **Timeout handling**: 30s request timeout, 5min total timeout

## Batch Processing & Queuing

### Asynchronous Workflow
- Submit requests with callback URLs
- Track progress using task IDs
- Real-time status updates via webhook or polling
- Automatic result delivery for completed jobs

### Optimal Batch Size
- **4 characters maximum** per batch for optimal performance
- Parallel processing for independent character generations
- Sequential processing for character variations/consistency

### Queue Implementation Requirements
- Priority-based queuing (user tiers, request types)
- Dead letter queue for failed requests
- Progress tracking and status reporting
- Resource pooling and load balancing

## Integration Architecture

### Recommended Client Structure
```
nanoBananaClient/
├── config/
│   ├── nanoBanana.ts        # API configuration
│   └── api.ts               # Shared API config (coordination)
├── services/
│   └── nanoBananaClient.ts  # Main API client
├── types/
│   ├── nanoBanana.ts        # API-specific types
│   └── generation.ts        # Shared generation types (coordination)
└── utils/
    └── authTokenManager.ts  # Authentication utilities
```

### Key Features to Implement
1. **Configuration Management**
   - Environment-based API endpoint selection
   - API key management and rotation
   - Provider fallback mechanisms

2. **Request Management**
   - Request validation and sanitization
   - Automatic retries with exponential backoff
   - Circuit breaker implementation

3. **Response Processing**
   - Image URL validation and caching
   - Metadata extraction and storage
   - Error normalization across providers

4. **Status Tracking**
   - Real-time generation progress
   - Webhook integration for completion notifications
   - Comprehensive logging and metrics

## Character Creation Workflow

### Input Processing
1. **Character Specifications**: Parse character traits, appearance, style
2. **Prompt Engineering**: Convert specifications to optimized prompts
3. **Request Validation**: Validate parameters and constraints
4. **Queue Submission**: Add to processing queue with priority

### Generation Process
1. **API Request**: Submit to nanoBanana with optimal parameters
2. **Progress Monitoring**: Track generation status and progress
3. **Result Processing**: Download and validate generated images
4. **Quality Assurance**: Check for generation errors or quality issues

### Post-Processing
1. **Image Optimization**: Resize, compress, format conversion
2. **Metadata Storage**: Save generation parameters and results
3. **Character Linking**: Associate with user's character collection
4. **Sharing/Export**: Enable user sharing and export options

## Performance & Monitoring

### Key Metrics
- **Generation Time**: Average time from request to completion
- **Success Rate**: Percentage of successful generations
- **API Response Time**: Latency for API calls
- **Queue Depth**: Number of pending requests
- **Error Rate**: Failed requests by error type

### Monitoring Implementation
- Request/response logging with sanitized sensitive data
- Performance metrics collection and alerting
- API quota usage tracking and warnings
- Circuit breaker state monitoring

## Security Considerations

### Data Protection
- No persistent storage of user images without consent
- API key encryption in transit and at rest
- Request/response data sanitization for logs
- Compliance with data retention policies

### API Security
- Request signing for enterprise integrations
- IP whitelisting for production environments
- Rate limiting per user/API key
- Audit logging for security events

## Cost Optimization

### Strategies
- Provider comparison and automatic switching
- Image caching to avoid duplicate generations
- Batch processing for cost efficiency
- Quality vs. cost trade-off controls

### Budget Management
- Per-user spending limits
- Monthly/daily quota tracking
- Cost alerts and notifications
- Usage analytics and reporting

## Next Steps

1. **Implement API Client Foundation**
   - Create configuration and authentication modules
   - Implement basic request/response handling
   - Add error handling and retry logic

2. **Add Batch Processing Support**
   - Design queue system for up to 4 character batch processing
   - Implement progress tracking and status updates
   - Add webhook/polling mechanisms

3. **Create Coordination Interfaces**
   - Define shared types for Stream B (Queue System)
   - Create API configuration for Stream D coordination
   - Establish integration points for character workflow

4. **Testing and Validation**
   - Unit tests for all client components
   - Integration tests with actual API calls
   - Performance benchmarks and load testing