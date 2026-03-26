FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Generate base.db with real fixtures so new saves work immediately
RUN node db/seed.js --real
EXPOSE 3000
CMD ["node", "index.js"]
