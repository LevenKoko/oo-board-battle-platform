# Stage 1: Build Frontend
FROM node:18-alpine as frontend-builder

WORKDIR /app/frontend

# Copy package.json and lock file
COPY frontend/package.json frontend/package-lock.json ./

# Install dependencies
RUN npm install

# Copy frontend source code
COPY frontend/ ./

# Build the React app
RUN npm run build

# Stage 2: Setup Backend and Serve
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies (optional, pymysql usually doesn't need gcc)
# RUN apt-get update && apt-get install -y default-libmysqlclient-dev build-essential

# Copy backend requirements
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
# We copy the whole project structure to keep imports working (e.g. board_battle_project.backend...)
# But we only need the backend folder and __init__.py files
COPY backend /app/board_battle_project/backend
COPY __init__.py /app/board_battle_project/__init__.py

# Copy frontend build artifacts from Stage 1 to a directory the backend can serve
COPY --from=frontend-builder /app/frontend/dist /app/frontend_dist

# Set PYTHONPATH so python can find the module
ENV PYTHONPATH=/app

# Expose port
EXPOSE 8000

# Start the application
# Note: Ensure your main.py mounts '/app/frontend_dist' to '/'
CMD ["uvicorn", "board_battle_project.backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
