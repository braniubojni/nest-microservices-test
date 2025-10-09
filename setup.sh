echo "Creating environment files..."

# Creating .env.development file
cat > .env.development << 'EOF'
# Server Configuration
SERVICE_A_PORT=3000
SERVICE_B_PORT=3001

# Mongo Configuration
MONGO_LOGIN=admin
MONGO_PASSWORD=admin123
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_AUTHDATABASE=admin
EXTERNAL_API_URL="https://dummyjson.com/products"

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
EOF

# Creating empty production .env.production file
cat > .env.production << 'EOF'
# Server Configuration
SERVICE_A_PORT=
SERVICE_B_PORT=

# Mongo Configuration
MONGO_LOGIN=
MONGO_PASSWORD=
MONGO_HOST=
MONGO_PORT=
MONGO_AUTHDATABASE=
EXTERNAL_API_URL=

# Redis Configuration
REDIS_HOST=
REDIS_PORT=
REDIS_PASSWORD=
EOF

# Creating .env.test file
cat > .env.test << 'EOF'
# Server Configuration
SERVICE_A_PORT=3000
SERVICE_B_PORT=3001

# Mongo Configuration
MONGO_LOGIN=admin
MONGO_PASSWORD=admin123
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_AUTHDATABASE=admin
EXTERNAL_API_URL="https://dummyjson.com/products"

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
EOF