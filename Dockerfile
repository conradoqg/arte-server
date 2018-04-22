FROM node:carbon-alpine

WORKDIR /arte-server

VOLUME /arte-server/data

COPY . /arte-server

RUN apk update && apk upgrade && \
    apk add --no-cache bash git openssh python make g++
    
RUN npm install forever -g
RUN npm install

EXPOSE 80
EXPOSE 9229

ENTRYPOINT forever --spinSleepTime 5000 --minUptime 1000 -c "node --inspect=0.0.0.0:9229" bin/arte-server.js 