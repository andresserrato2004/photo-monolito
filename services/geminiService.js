import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION & KEY MANAGEMENT ---

// Single API Key usage
const API_KEY = process.env.GOOGLE_API_KEY || (process.env.GOOGLE_API_KEYS ? process.env.GOOGLE_API_KEYS.split(',')[0].trim() : "");

if (!API_KEY) {
  console.warn("WARNING: No GOOGLE_API_KEY provided. Requests will likely fail.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- MAIN GENERATION FUNCTION ---

export const generateGraduationImage = async (userImagePath, backgroundPath, diplomaPath, gender, userName, career) => {
    try {
      // 2. Prepare Files
      const userImageBase64 = fs.readFileSync(userImagePath, { encoding: 'base64' });
      const backgroundImageBase64 = fs.readFileSync(backgroundPath, { encoding: 'base64' });
      const diplomaImageBase64 = fs.readFileSync(diplomaPath, { encoding: 'base64' });

      // 3. Build Prompt (Same as before)
      const prompt = gender === 'female'
        ? `Generate a high-quality, photorealistic 2K image of the person provided in the reference image (first image). She is celebrating her graduation. 
           She should be wearing an elegant formal dress suitable for a graduation ceremony, looking professional, confident, and 5 years older than in the reference photo.
           
           CRITICAL: She must NOT be wearing a graduation gown (toga) or a graduation cap (birrete). She should only be wearing the elegant formal dress.

           KEY ELEMENTS FROM REFERENCES:
           1. DIPLOMA WITH FRAME: She is holding the specific graduation diploma shown in the third reference image. 
              - CRITICAL: The diploma MUST include the black frame with the specific angular corners as shown in the reference image.
              - The text on the diploma MUST be modified to clearly display her name: "${userName}" and the title: "${career}".
              - Keep the institution name "Escuela Colombiana de Ingeniería Julio Garavito" if visible in the reference.
              - Ensure the text is legible, correctly spelled, and matches the style of the reference diploma.
           
           2. BACKGROUND: The background MUST match the second reference image provided (a university campus setting). 
              - Integrate the person naturally into this specific environment.
              - The lighting on the person should match the natural, sunny lighting of the background scene.

           The overall atmosphere should be solemn and happy, perfect for a graduation memory.`
        : `Generate a high-quality, photorealistic 2K image of the person provided in the reference image (first image). He is celebrating his graduation.
           He should be dressed formally in a white dress shirt, tie, and suit jacket. He looks professional, confident, and 5 years older than in the reference photo.
           
           KEY ELEMENTS FROM REFERENCES:
           1. DIPLOMA WITH FRAME: He is holding the specific graduation diploma shown in the third reference image. 
              - CRITICAL: The diploma MUST include the black frame with the specific angular corners as shown in the reference image.
              - The text on the diploma MUST be modified to clearly display his name: "${userName}" and the title: "${career}".
              - Keep the institution name "Escuela Colombiana de Ingeniería Julio Garavito" if visible in the reference.
              - Ensure the text is legible, correctly spelled, and matches the style of the reference diploma.
           
           2. BACKGROUND: The background MUST match the second reference image provided (a university campus setting). 
              - Integrate the person naturally into this specific environment.
              - The lighting on the person should match the natural, sunny lighting of the background scene.

           The overall atmosphere should be solemn and happy, perfect for a graduation memory.`;

      const contents = [
        { text: prompt },
        { inlineData: { mimeType: "image/png", data: userImageBase64 } },
        { inlineData: { mimeType: "image/png", data: backgroundImageBase64 } },
        { inlineData: { mimeType: "image/jpeg", data: diplomaImageBase64 } }
      ];

      // 4. Call API
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image', 
        contents: contents,
        config: {
          responseModalities: ['IMAGE'], 
          imageConfig: {
            aspectRatio: '9:16', 
            imageSize: '2K',    
          },
        },
      });

      // 5. Process Response
      let imageBuffer = null;
      if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            imageBuffer = Buffer.from(part.inlineData.data, "base64");
            break; 
          }
        }
      }

      if (!imageBuffer) {
        throw new Error("Gemini no retornó ninguna imagen (Empty Response).");
      }

      return imageBuffer;

    } catch (error) {
      console.error(`Error with Gemini API:`, error.message);
      throw error;
    }
};

/**
 * Nueva implementación usando el modelo 'gemini-2.5-flash-image'.
 * Ideal para edición de imagen rápida y eficiente (Text-and-Image-to-Image).
 */
export const generateGraduationImageFlash = async (userImagePath, backgroundPath, diplomaPath, gender, userName, career) => {
    try {
      // Prepare Files
      const userImageBase64 = fs.readFileSync(userImagePath, { encoding: 'base64' });
      // Note: gemini-2.5-flash-image might behave differently with multiple reference images than gemini-3-pro.
      // We will try providing them as parts of the prompt content similar to the example.
      
      // Build Prompt
      const promptText = gender === 'female'
        ? `Edit the input image (the person) to create a high-quality graduation photo.
           The person should be wearing an elegant formal dress suitable for a graduation ceremony.
           She must NOT wear a gown or cap.
           
           COMPOSITION:
           - Person: ${userName}, looking professional and happy.
           - Holding: The diploma shown in the provided reference image (ensure the frame and text '${userName}' / '${career}' are visible).
           - DIPLOMA FRAME: The diploma MUST be surrounded by a plain black frame. 
           - SIGNATURES: DO NOT add any signatures, watermarks, or text overlays to the diploma or the image.
           - Background: Use the provided university campus background reference.
           
           Output a photorealistic image with 9:16 aspect ratio.`
        : `Edit the input image (the person) to create a high-quality graduation photo.
           The person should be wearing a formal white shirt, tie, and suit jacket.
           
           COMPOSITION:
           - Person: ${userName}, looking professional and happy.
           - Holding: The diploma shown in the provided reference image (ensure the frame and text '${userName}' / '${career}' are visible).
           - DIPLOMA FRAME: The diploma MUST be surrounded by a plain black frame. 
           - SIGNATURES: DO NOT add any signatures, watermarks, or text overlays to the diploma or the image.
           - Background: Use the provided university campus background reference.
           
           Output a photorealistic image with 9:16 aspect ratio.`;

      // Construct contents array
      // According to the example provided:
      // const prompt = [{ text: "..." }, { inlineData: { ... } }];
      const contents = [
        { text: promptText },
        { 
          inlineData: { 
            mimeType: "image/png", 
            data: userImageBase64 
          } 
        },
        // We can attach other references as additional inlineData parts
        {
             inlineData: {
                 mimeType: "image/png",
                 data: fs.readFileSync(backgroundPath, { encoding: 'base64' })
             }
        },
        {
            inlineData: {
                mimeType: "image/jpeg",
                data: fs.readFileSync(diplomaPath, { encoding: 'base64' })
            }
        }
      ];

      // Call API with gemini-2.5-flash-image
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: contents,
        config: {
           // Flash specific config might differ slightly, but responseModalities is key
           // If 'imageConfig' is not supported by Flash, remove it. Keeping it based on previous pattern.
           responseModalities: ['IMAGE'], 
        },
      });

      // Process Response
      let imageBuffer = null;
      if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            imageBuffer = Buffer.from(part.inlineData.data, "base64");
            break; 
          }
        }
      }

      if (!imageBuffer) {
        throw new Error("Gemini Flash no retornó ninguna imagen.");
      }

      return imageBuffer;

    } catch (error) {
      console.error(`Error with Gemini Flash API:`, error.message);
      throw error;
    }
};
