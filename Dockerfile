FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 7860
ENV PORT=7860
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/main"]
