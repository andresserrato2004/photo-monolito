import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';

const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEYS.split(',')[0];
const ai = new GoogleGenAI({ apiKey });

async function listModels() {
  try {
    console.log("Fetching available models...");
    const response = await ai.models.list();
    
    // The response structure can vary, handling standard listing
    const models = response.models || response;
    
    console.log("\n--- AVAILABLE MODELS ---");
    models.forEach(model => {
      // Filter for likely image generation candidates or just show all
      if (model.supportedGenerationMethods.includes('generateContent') || model.name.includes('imagen') || model.name.includes('vision')) {
        console.log(`Name: ${model.name}`);
        console.log(`Methods: ${model.supportedGenerationMethods.join(', ')}`);
        console.log("-------------------");
      }
    });
  } catch (error) {
    console.error("Error listing models:", error);
  }
}

listModels();
