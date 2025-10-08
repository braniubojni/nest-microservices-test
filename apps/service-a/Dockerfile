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

RUN npm run build -- service-a

FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache \
	cairo \
	pango \
	libpng \
	libjpeg-turbo \
	giflib

COPY --from=build /app/node_modules ./node_modules

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/apps/service-a/main"]