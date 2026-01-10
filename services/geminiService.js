import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';

// Asegúrate de tener GOOGLE_API_KEY en tu .env
// No se necesita inicializar con apiKey explícita si la variable de entorno GOOGLE_API_KEY está seteada
// Pero para consistencia con el ejemplo, podemos pasar opciones si es necesario.
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

export const generateGraduationImage = async (userImagePath, backgroundPath, diplomaPath, gender, userName, career) => {
  try {
    // 1. Convertir imágenes a Base64
    const userImageBase64 = fs.readFileSync(userImagePath, { encoding: 'base64' });
    const backgroundImageBase64 = fs.readFileSync(backgroundPath, { encoding: 'base64' });
    const diplomaImageBase64 = fs.readFileSync(diplomaPath, { encoding: 'base64' });

    // 2. Construir el prompt detallado
    const prompt = gender === 'female'
      ? `Generate a high-quality, photorealistic 2K image of the person provided in the reference image (first image). She is celebrating her graduation. 
         She should be wearing an elegant formal dress suitable for a graduation ceremony, looking professional, confident, and 5 years older than in the reference photo.
         
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

    // 3. Preparar contenidos para Gemini
    const contents = [
      { text: prompt },
      {
        inlineData: {
          mimeType: "image/png", // Foto de usuario
          data: userImageBase64,
        },
      },
      {
        inlineData: {
          mimeType: "image/png", // Background (png)
          data: backgroundImageBase64,
        },
      },
      {
        inlineData: {
          mimeType: "image/jpeg", // Diploma (jpeg) - Ahora incluye el marco
          data: diplomaImageBase64,
        },
      }
    ];

    // 4. Llamar a la API
    console.log("Generando imagen con Gemini 3 Pro (3 referencias con marco)...");
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: contents,
      config: {
        responseModalities: ['IMAGE'], // Solo queremos imagen (o TEXT, IMAGE si quisieras debug)
        imageConfig: {
          aspectRatio: '9:16', // Cambiado a 9:16 como solicitado
          imageSize: '2K',    // Aprovechando la capacidad de alta resolución
        },
      },
    });

    // 5. Procesar respuesta
    let imageBuffer = null;

    if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const imageData = part.inlineData.data;
          imageBuffer = Buffer.from(imageData, "base64");
          break; // Tomamos la primera imagen generada
        }
      }
    }

    if (!imageBuffer) {
      throw new Error("Gemini no retornó ninguna imagen.");
    }

    return imageBuffer;

  } catch (error) {
    console.error("Error en generateGraduationImage (Gemini):", error);
    throw error;
  }
};
