# Use Node.js v20.17.0 as the base image
FROM node:20.17.0

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files to the working directory
COPY . .

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["npm", "start"]