import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import dotenv from 'dotenv';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export const uploadImageToS3 = async (buffer, filename, contentType = 'image/png') => {
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: filename,
    Body: buffer,
    ContentType: contentType,
  };

  try {
    const command = new PutObjectCommand(params);
    await s3Client.send(command);
    
    // Al ser un bucket privado, NO retornamos una URL pública (no funcionaría).
    // Retornamos el Key (filename) para guardarlo en la BD.
    return filename;
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw new Error("Failed to upload image to S3");
  }
};

// Generar URL firmada temporal para visualizar la imagen en el frontend
export const getSignedImageUrl = async (filename) => {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: filename,
    });
    
    // La URL expirará en 1 hora (3600 segundos)
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return url;
  } catch (error) {
    console.error("Error generating signed URL:", error);
    return null;
  }
};
