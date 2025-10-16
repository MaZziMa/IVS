# AWS IVS Streaming Application Instructions

This project creates a web streaming application using:
- AWS IVS (Interactive Video Service) for live streaming
- AWS DynamoDB for data storage
- AWS Cognito for user authentication
- Node.js backend with Express
- Vanilla JavaScript frontend

## Architecture
- Frontend: HTML/CSS/JavaScript with AWS IVS Player
- Backend: Node.js/Express API server
- Authentication: AWS Cognito User Pools
- Database: DynamoDB for user and stream data
- Streaming: AWS IVS for live video streaming

## Development Guidelines
- Use AWS SDK v3 for all AWS service integrations
- Implement proper error handling and logging
- Follow security best practices for AWS credentials
- Use environment variables for configuration
- Implement responsive design for mobile compatibility