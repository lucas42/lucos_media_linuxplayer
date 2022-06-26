FROM node:18-bullseye

RUN apt-get update
RUN apt-get install mplayer -y
WORKDIR /usr/src/app
COPY package* ./
RUN npm install

COPY . .

CMD [ "npm", "start" ]