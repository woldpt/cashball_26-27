FROM node:24-alpine
WORKDIR /app
# sqlite3 precisa de toolchain nativo quando prebuild não cobre a plataforma
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm install
COPY . .
RUN chmod +x entrypoint.sh && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["sh", "entrypoint.sh"]
