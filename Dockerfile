FROM node:20

WORKDIR /app

# Copy the backend files
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copy the frontend files
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install --legacy-peer-deps

# Copy all source files
COPY . .

# Build the frontend and copy to backend/dist
RUN cd frontend && npm run build && cp -r dist ../backend/dist

# Hugging Face Spaces runs as user 1000 and requires port 7860
RUN chmod -R 777 /app
USER 1000

# Expose port and start
EXPOSE 7860
WORKDIR /app/backend
CMD ["node", "index.js"]
