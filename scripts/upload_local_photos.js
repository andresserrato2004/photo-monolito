import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import mime from 'mime-types';
import dotenv from 'dotenv';

// Load .env variables
dotenv.config();

// Reconstruct __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Configure S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// CHANGE THIS PATH TO WHERE YOUR PHOTOS ARE LOCATED
const PHOTOS_DIR = path.join(__dirname, '../local_photos'); 
const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

// Helper to pause execution
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function uploadPhotos() {
  if (!BUCKET_NAME) {
    console.error("❌ AWS_BUCKET_NAME is not defined in .env");
    return;
  }

  // Ensure directory exists
  if (!fs.existsSync(PHOTOS_DIR)) {
      console.error(`❌ Directory not found: ${PHOTOS_DIR}`);
      console.log("Please create a folder named 'local_photos' in the project root and put your images there.");
      return;
  }

  try {
    const files = fs.readdirSync(PHOTOS_DIR);
    console.log(`📂 Found ${files.length} files in ${PHOTOS_DIR}`);

    for (const file of files) {
      if (file.startsWith('.')) continue;

      const filePath = path.join(PHOTOS_DIR, file);
      const fileExt = path.extname(file);
      // Assuming file name is strictly the ID (e.g. "12345.jpg")
      const userId = path.basename(file, fileExt); 

      console.log(`\nProcessing: ${file} (ID: ${userId})`);

      // 1. Check DB
      // Note: Adjust 'id' type parsing if your DB uses Int instead of String
      // If DB id is Int: const numericId = parseInt(userId);
      const user = await prisma.user.findUnique({
        where: { id: userId } 
      });

      if (!user) {
        console.warn(`⚠️ User with ID ${userId} not found in DB. Skipping.`);
        continue;
      }

      // 2. Upload S3
      const fileContent = fs.readFileSync(filePath);
      const contentType = mime.lookup(filePath) || 'application/octet-stream';
      const s3Key = file; // Keeping original name as requested

      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: fileContent,
        ContentType: contentType,
      }));

      console.log(`✅ Uploaded to S3: ${s3Key}`);

      // 3. Update DB
      await prisma.user.update({
        where: { id: userId },
        data: { image: s3Key }
      });

      console.log(`💾 Linked to User: ${user.name}`);

      // Rate limit: 15 photos/min = 1 photo every 4 seconds
      console.log("⏳ Esperando 4 segundos (Rate Limit: 15/min)...");
      await sleep(4000);
    }

    console.log("\n🎉 Done!");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

uploadPhotos();
