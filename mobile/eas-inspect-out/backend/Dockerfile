FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer cache).
COPY package*.json ./
RUN npm install --omit=dev

# Copy backend source.
COPY . .

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["npm", "start"]
