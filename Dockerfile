FROM node:6
RUN apt-get update && apt-get install -y \
  libcairo2-dev \
  libjpeg-dev \
  libpango1.0-dev \
  libgif-dev \
  librsvg2-dev \
  build-essential \
  g++

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 8080
CMD [ "node", "server.js" ]