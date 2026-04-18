FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN chmod +x entrypoint.sh && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["sh", "entrypoint.sh"]
