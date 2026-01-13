import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { generateGraduationImageFlash } from '../services/geminiService.js';
import { uploadImageToS3 } from '../services/s3Service.js';
import 'dotenv/config';

const prisma = new PrismaClient();
const PHOTOS_DIR = path.join(process.cwd(), 'local_photos');
const ASSETS_DIR = path.join(process.cwd(), 'assets');

async function processPhotosFlash() {
  try {
    const files = fs.readdirSync(PHOTOS_DIR);
    console.log(`📂 Found ${files.length} files in ${PHOTOS_DIR}`);

    for (const file of files) {
      if (file.startsWith('.')) continue; // Ignore .DS_Store
      
      const userId = path.parse(file).name;
      console.log(`\n--------------------------------------------------`);
      console.log(`📸 Processing User ID: ${userId} (File: ${file})`);

      // 1. Buscar usuario en DB
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        console.warn(`⚠️ User not found in DB for ID: ${userId}. Skipping.`);
        continue;
      }

      console.log(`👤 User Found: ${user.name} (${user.gender}) - ${user.career}`);

      // 2. Rutas de archivos
      const userImagePath = path.join(PHOTOS_DIR, file);
      const backgroundPath = path.join(ASSETS_DIR, 'background.png'); 
      // Ensure this matches your actual asset filename
      const diplomaPath = path.join(ASSETS_DIR, 'diploma.png'); 

      if (!fs.existsSync(backgroundPath) || !fs.existsSync(diplomaPath)) {
         console.error(`❌ Assets missing! Check ${ASSETS_DIR}`);
         continue;
      }

      try {
        console.log("🤖 Generating AI Image with Gemini Flash 2.5...");
        
        // 3. Generar Imagen con Flash
        const imageBuffer = await generateGraduationImageFlash(
          userImagePath, 
          backgroundPath, 
          diplomaPath, 
          user.gender, 
          user.name, 
          user.career
        );

        // 4. Subir a S3
        const timestamp = Date.now();
        const sanitizedName = user.name.replace(/ /g, '_').toUpperCase();
        const fileName = `${sanitizedName}_graduado_flash_${timestamp}.png`;
        
        // CORRECCIÓN: La función importada se llama uploadImageToS3, no uploadToS3
        // y el orden de argumentos es (buffer, filename, contentType)
        await uploadImageToS3(imageBuffer, fileName, 'image/png');
        console.log(`✅ AI Image Uploaded to S3: ${fileName}`);

        // 5. Actualizar DB
        await prisma.user.update({
          where: { id: userId },
          data: { image: fileName }
        });
        console.log(`💾 Database updated for user ${user.name}`);

      } catch (err) {
        console.error(`❌ Error generating/uploading image for ${user.name}:`, err);
      }

      // Esperar para evitar rate limits (aunque el servicio ya lo maneja, un extra no sobra)
      // console.log("⏳ Waiting 5 seconds before next user...");
      // await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log(`\n🎉 All photos processed with Flash!`);

  } catch (error) {
    console.error("Fatal Error in script:", error);
  } finally {
    await prisma.$disconnect();
  }
}

processPhotosFlash();