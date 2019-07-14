FROM node:10-alpine

EXPOSE 8080

WORKDIR /home
COPY . . 
RUN npm install --production

CMD ["node", "index.js"]