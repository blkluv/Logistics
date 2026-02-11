const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

// Check if .env file already exists
if (fs.existsSync(envPath)) {
  console.log('.env file already exists. Skipping creation.');
  process.exit(0);
}

// Default environment variables
const envContent = `# MongoDB Connection String
MONGO_URI=mongodb://localhost:27017/route-optimization

# Server Port
PORT=5000

# Mapbox API Token (Get from https://account.mapbox.com/)
MAPBOX_TOKEN=your_mapbox_api_token_here

# Google Gemini API Key (Get from https://makersuite.google.com/app/apikey)
GEMINI_API_KEY=your_gemini_api_key_here

# Environment
NODE_ENV=development
`;

// Write .env file
fs.writeFileSync(envPath, envContent);

console.log('.env file created successfully!');
console.log('Please update the values according to your setup:');
console.log('- MONGO_URI: Your MongoDB connection string');
console.log('- PORT: The port your server should run on');
console.log('- MAPBOX_TOKEN: Your Mapbox API token');
console.log('- GEMINI_API_KEY: Your Google Gemini API key');
