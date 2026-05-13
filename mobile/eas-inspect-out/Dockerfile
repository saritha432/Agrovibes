FROM node:20-alpine

WORKDIR /app

# Install backend dependencies first for better cache reuse.
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy backend source.
COPY backend/ ./

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["npm", "start"]
