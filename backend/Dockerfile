FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production=false

COPY . .

RUN npm run build || true

EXPOSE 9182

CMD ["npm", "start"]
