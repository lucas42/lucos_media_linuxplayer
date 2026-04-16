FROM node:25-bookworm
ARG VERSION
ENV VERSION=$VERSION

RUN apt-get update
RUN apt-get install mplayer -y
WORKDIR /usr/src/app
COPY package* ./
RUN npm install

COPY src src

CMD [ "npm", "start" ]