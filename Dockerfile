# Use official Node.js 22 LTS Alpine image
FROM node:22-alpine

# Set working directory inside container
WORKDIR /app

# Copy backend package manifests from server directory
COPY server/package*.json ./

# Install only production dependencies cleanly using lockfile
RUN npm ci --omit=dev

# Copy backend source files preserving required architecture
COPY server/controllers ./controllers
COPY server/middleware ./middleware
COPY server/models ./models
COPY server/routes ./routes
COPY server/utils ./utils
COPY server/server.js ./server.js

# Ensure non-root ownership of all copied files
RUN chown -R node:node /app

# Set default production environment
ENV NODE_ENV=production

# Switch to unprivileged non-root user for security
USER node

# Expose default port (Render dynamically assigns PORT at runtime, e.g. 10000)
EXPOSE 5000

# Start Express server using the production start script
CMD ["npm", "start"]
