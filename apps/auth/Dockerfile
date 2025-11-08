FROM node:alpine AS development

WORKDIR /usr/src/app

COPY package*.json ./
COPY tsconfig.json nest-cli.json ./

RUN npm install

COPY apps/auth ./apps/auth
COPY libs ./libs

RUN npm run build auth

# Production stage
FROM node:alpine AS production

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --only=production

COPY --from=development /usr/src/app/dist ./dist

CMD ["node", "dist/apps/auth/main"]
