# Use official Node.js 22 LTS Alpine image
FROM node:22-alpine

# Set working directory inside container
WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY package*.json ./

# Install only production dependencies cleanly
RUN npm ci --omit=dev

# Copy application source files with ownership assigned to non-root node user
COPY --chown=node:node . .

# Set default production environment
ENV NODE_ENV=production

# Switch to unprivileged user for security
USER node

# Expose internal listening port (Railway sets PORT environment variable dynamically)
EXPOSE 5000

# Start server using the standard production start script
CMD ["npm", "start"]
