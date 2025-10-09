FROM node:20-alpine AS build

WORKDIR /app

RUN apk add --no-cache \
	python3 \
	make \
	g++ \
	cairo-dev \
	pango-dev \
	libpng-dev \
	jpeg-dev \
	giflib-dev \
	pixman-dev

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build -- service-b

FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache \
	cairo \
	pango \
	libpng \
	libjpeg-turbo \
	giflib \
	fontconfig \
	ttf-dejavu \
	ttf-droid \
	ttf-freefont \
	ttf-liberation \
	python3 \
	make \
	g++ \
	cairo-dev \
	pango-dev \
	libpng-dev \
	jpeg-dev \
	giflib-dev \
	pixman-dev

COPY package*.json ./

# Install only production dependencies and rebuild native modules
RUN npm ci --only=production && npm rebuild canvas

COPY --from=build /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/apps/service-b/main"]