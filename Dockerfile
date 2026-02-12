# Use the official Node.js image as the base image
FROM node:24-alpine

# COMMIT_HASH is set in GitHub actions build, and passed to app as envvar
ARG COMMIT_HASH
ENV APP_VERSION=$COMMIT_HASH

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["node", "src/app.js"]