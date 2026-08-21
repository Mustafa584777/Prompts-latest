import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  const res = await ai.models.generateContent({
    model: 'imagen-3.0-generate-002',
    contents: 'A futuristic city skyline at sunset',
  });
  console.log("Response:", res);
}
run().catch(console.error);
