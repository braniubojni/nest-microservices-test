FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci --ignore-scripts

COPY . .

RUN npm run build -- service-a

FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./

# Install production dependencies. 
# Note: '--ignore-scripts' is used because service-a currently does not require any npm install scripts (e.g., native modules).
# If you add dependencies that require install scripts, remove '--ignore-scripts' from the command below.
RUN npm ci --only=production --ignore-scripts

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/apps/service-a/main"]