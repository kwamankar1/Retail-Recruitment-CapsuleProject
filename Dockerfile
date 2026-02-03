FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy application code
COPY . .

# App runs on this port
EXPOSE 3000

# Start the app
CMD ["node", "server.js"]

