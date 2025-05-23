# Use official Node.js image
FROM node:18

# Set working directory
WORKDIR /app

# Copy only package files first to install dependencies
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app
COPY . .

# Make wait-for-it.sh executable
RUN chmod +x wait-for-it.sh

# Start using nodemon
CMD ["npm", "run", "dev"]