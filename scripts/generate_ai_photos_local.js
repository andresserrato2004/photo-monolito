import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import mime from 'mime-types';
import dotenv from 'dotenv';
import { generateGraduationImage } from '../services/geminiService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const PHOTOS_DIR = path.join(__dirname, '../local_photos'); 
const ASSETS_DIR = path.join(__dirname, '../assets'); // Asumiendo que assets está en la raíz
const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

const BACKGROUND_PATH = path.join(ASSETS_DIR, 'background.png');
const DIPLOMA_PATH = path.join(ASSETS_DIR, 'diploma.png');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function processPhotos() {
  if (!BUCKET_NAME) {
    console.error("❌ AWS_BUCKET_NAME is not defined in .env");
    return;
  }
  if (!process.env.GOOGLE_API_KEY) {
    console.error("❌ GOOGLE_API_KEY is not defined in .env");
    return;
  }

  if (!fs.existsSync(PHOTOS_DIR)) {
      console.error(`❌ Directory not found: ${PHOTOS_DIR}`);
      return;
  }

  try {
    const files = fs.readdirSync(PHOTOS_DIR);
    console.log(`📂 Found ${files.length} files in ${PHOTOS_DIR}`);

    for (const file of files) {
      if (file.startsWith('.')) continue;

      const filePath = path.join(PHOTOS_DIR, file);
      const fileExt = path.extname(file);
      const userId = path.basename(file, fileExt); 

      console.log(`\n--------------------------------------------------`);
      console.log(`📸 Processing User ID: ${userId} (File: ${file})`);

      // 1. Get User Data from DB
      const user = await prisma.user.findUnique({
        where: { id: userId } 
      });

      if (!user) {
        console.warn(`⚠️ User with ID ${userId} not found in DB. Skipping.`);
        continue;
      }

      console.log(`👤 User Found: ${user.name} (${user.gender}) - ${user.career}`);

      // 2. Generate Image with AI
      try {
        console.log("🤖 Generating AI Image with Gemini...");
        
        // Use user.gender from DB, default to 'male' if missing, ensuring lowercase
        const gender = (user.gender || 'male').toLowerCase(); 
        
        const generatedImageBuffer = await generateGraduationImage(
            filePath,       // User photo path
            BACKGROUND_PATH,// Background path
            DIPLOMA_PATH,   // Diploma path
            gender,         // 'male' or 'female'
            user.name,      // User Name for diploma
            user.career     // Career for diploma
        );

        // 3. Upload Generated Image to S3
        // New filename format: Name_Date_ID.png (similar to your previous convention)
        const timestamp = Date.now();
        // Sanitize name for filename
        const sanitizedName = user.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, ''); 
        const newFileName = `${sanitizedName}_graduado_${timestamp}.png`;
        
        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: newFileName,
            Body: generatedImageBuffer,
            ContentType: 'image/png',
        }));

        console.log(`✅ AI Image Uploaded to S3: ${newFileName}`);

        // 4. Update DB with the NEW generated image name
        await prisma.user.update({
            where: { id: userId },
            data: { image: newFileName }
        });

        console.log(`💾 Database updated for user ${user.name}`);

      } catch (aiError) {
          console.error(`❌ Error generating/uploading image for ${user.name}:`, aiError);
      }

      // Rate limit: 1 photo every 20 seconds to be safe with AI API + S3 + avoid spamming
      // 15/min = 4s, but AI takes time. Let's give it a buffer.
      console.log("⏳ Waiting 10 seconds before next user...");
      await sleep(10000);
    }

    console.log("\n🎉 All photos processed!");

  } catch (error) {
    console.error("❌ Fatal Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

processPhotos();
