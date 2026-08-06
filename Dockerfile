FROM node:18-alpine

WORKDIR /app

# Copy the backend files
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copy the frontend files
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

# Copy all source files
COPY . .

# Build the frontend and copy to backend/dist
RUN cd frontend && npm run build && cp -r dist ../backend/dist

# Expose port and start
EXPOSE 3001
WORKDIR /app/backend
CMD ["node", "index.js"]
