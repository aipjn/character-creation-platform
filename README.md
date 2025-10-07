# Character Creation Platform

AI-powered character generation platform for video creators and advertising professionals using Google's nanoBanana model.

## Overview

This platform provides a streamlined two-step workflow:
1. **Base Character Generation**: Create characters from text descriptions or uploaded photos
2. **Advanced Styling**: Modify poses, actions, and scenes

## Features

- Text-to-character and photo-to-character generation
- Batch processing (up to 4 character variations)
- Both cartoon and realistic character styles
- Freemium model (3 free daily generations)
- Professional subscription tiers

## Tech Stack

- **Frontend**: React with TypeScript
- **Backend**: Node.js with Express
- **Database**: PostgreSQL
- **Storage**: Local filesystem storage
- **Authentication**: Auth0
- **Payments**: Stripe
- **AI**: Google nanoBanana API

## Getting Started

Coming soon - development in progress.

### Google Gemini Proxy (Optional)

The Gemini client now treats proxy usage as opt-in. By default, it connects directly.

To enable the proxy for environments that cannot reach Google, export the
environment variable before starting the server:

```bash
export GEMINI_PROXY_ENABLED=true
export GEMINI_PROXY_URL="http://127.0.0.1:7890" # optional; falls back to HTTPS_PROXY/HTTP_PROXY
npm run dev
```

Unset or skip the variables to let the service run without any proxy:

```bash
unset GEMINI_PROXY_ENABLED GEMINI_PROXY_URL
npm run dev
```

## Project Management

This project uses Claude Code PM system with structured PRDs and task breakdown.
See `.claude/` directory for detailed requirements and implementation tasks.
