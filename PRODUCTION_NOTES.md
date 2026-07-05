# AI Interview Assistant - Production Notes

## Backend env variables on Render

OPENAI_API_KEY=your_openai_key
DEEPGRAM_API_KEY=your_deepgram_key
OPENAI_MODEL=gpt-5.5

## Frontend env variables on Vercel

VITE_API_BASE_URL=https://your-render-service.onrender.com
VITE_WS_URL=wss://your-render-service.onrender.com

## Local run

Backend:
cd backend
npm install
npm start

Frontend:
npm install
npm run dev

## Main changes included

- Deepgram Nova-3 live WebSocket transcription
- OpenAI streaming answer route
- Markdown streamed answer UI
- Faster 70-100 word interview-style prompt
- Bigger answer fonts
- Stop interview floating button support
