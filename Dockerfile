FROM debian:bullseye

RUN apt-get update
RUN apt-get install nodejs npm mplayer -y
WORKDIR /usr/src/app
COPY package* ./
RUN npm install

COPY . .

CMD [ "npm", "start" ]