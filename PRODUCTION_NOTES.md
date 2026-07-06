# Production Notes

## Local frontend `.env`
VITE_API_BASE_URL=http://localhost:5000
VITE_WS_URL=ws://localhost:5000

## Vercel Environment Variables
VITE_API_BASE_URL=https://your-render-backend.onrender.com
VITE_WS_URL=wss://your-render-backend.onrender.com

Do not add trailing `/` at the end.

## Render Environment Variables
OPENAI_API_KEY=your_openai_api_key
DEEPGRAM_API_KEY=your_deepgram_api_key
OPENAI_MODEL=gpt-5.5

## Render Settings
Root Directory: backend
Build Command: npm install
Start Command: npm start

## Testing live transcription
Use Chrome tab sharing and enable "Share tab audio".
