# Use official Node.js image
FROM node:18

# Set working directory in container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your app code
COPY . .

# Expose port your app runs on
EXPOSE 5500

# Start the app
CMD ["node", "server.js"]
