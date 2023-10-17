# Use an official Node.js runtime as a parent image
FROM node:14

# Set the working directory within the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install project dependencies
RUN npm install

# Bundle your app's source code inside the Docker image
COPY . .

# Specify the command to run when the container starts
CMD ["node", "app.js"]