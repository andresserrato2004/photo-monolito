import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
// import OpenAI, { toFile } from "openai"; // Ya no necesitamos OpenAI
import { uploadImageToS3, getSignedImageUrl } from './services/s3Service.js';
import { generateGraduationImageFlash } from './services/geminiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const prisma = new PrismaClient();
const app = express();
const port = process.env.PORT || 3001;

// Configurar multer para almacenamiento temporal
// En Vercel/serverless, solo /tmp es escribible
const uploadDir = process.env.VERCEL ? '/tmp/uploads' : 'uploads';
const upload = multer({ dest: uploadDir });

app.use(cors());
app.use(express.json());

// Servir archivos estáticos del build de React
app.use(express.static(path.join(__dirname, 'client/build')));

// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); // Ya no se usa



// ...existing code...

// Endpoint para obtener estudiantes por carrera específica
app.get('/api/users/career/:career', async (req, res) => {
  try {
    const { career } = req.params;
    
    // Buscar usuarios por carrera (búsqueda exacta, no case sensitive)
    const users = await prisma.user.findMany({
      where: {
        career: {
          contains: career,
          mode: 'insensitive' // Búsqueda sin distinguir mayúsculas/minúsculas
        }
      },
      select: {
        id: true,
        name: true,
        gender: true,
        career: true,
        createdAt: true,
        // image: false ← Sin imágenes para mejor rendimiento
      },
      orderBy: {
        name: 'asc' // Ordenar alfabéticamente por nombre
      }
    });

    res.status(200).json({
      success: true,
      career: career,
      count: users.length,
      users: users
    });

  } catch (error) {
    console.error('Error en /api/users/career:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Endpoint alternativo con query parameter
app.get('/api/users/filter', async (req, res) => {
  try {
    const { career, gender, limit } = req.query;
    
    // Construir filtros dinámicamente
    const whereClause = {};
    
    if (career) {
      whereClause.career = {
        contains: career,
        mode: 'insensitive'
      };
    }
    
    if (gender) {
      whereClause.gender = gender.toLowerCase();
    }

    const queryOptions = {
      where: whereClause,
      select: {
        id: true,
        name: true,
        gender: true,
        career: true,
        createdAt: true,
      },
      orderBy: {
        name: 'asc'
      }
    };

    // Agregar límite si se especifica
    if (limit) {
      queryOptions.take = parseInt(limit);
    }

    const users = await prisma.user.findMany(queryOptions);

    res.status(200).json({
      success: true,
      filters: {
        career: career || 'all',
        gender: gender || 'all',
        limit: limit || 'no limit'
      },
      count: users.length,
      users: users
    });

  } catch (error) {
    console.error('Error en /api/users/filter:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Endpoint para obtener lista de todas las carreras disponibles
app.get('/api/careers', async (req, res) => {
  try {
    const careers = await prisma.user.findMany({
      select: {
        career: true
      },
      distinct: ['career'],
      orderBy: {
        career: 'asc'
      }
    });

    const careerList = careers.map(user => user.career).filter(Boolean);

    res.status(200).json({
      success: true,
      count: careerList.length,
      careers: careerList
    });

  } catch (error) {
    console.error('Error en /api/careers:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});


// Endpoint para obtener todos los usuarios
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: 'desc' // Ordenar por fecha de creación, más recientes primero
      }
    });

    res.status(200).json({
      success: true,
      count: users.length,
      users: users
    });

  } catch (error) {
    console.error('Error en /api/users:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Endpoint alternativo sin imágenes (más rápido)
app.get('/api/users/summary', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        gender: true,
        career: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      success: true,
      count: users.length,
      users: users
    });

  } catch (error) {
    console.error('Error en /api/users/summary:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/users/paginated', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await prisma.user.findMany({
      skip: skip,
      take: limit,
      select: {
        id: true,
        name: true,
        gender: true,
        career: true,
        createdAt: true,
        // image: false ← Sin imágenes para mejor rendimiento
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const totalUsers = await prisma.user.count();
    const totalPages = Math.ceil(totalUsers / limit);

    res.status(200).json({
      success: true,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalUsers: totalUsers,
        usersPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      users: users
    });

  } catch (error) {
    console.error('Error en /api/users/paginated:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});



app.post('/api/ced', async(req, res) => {
  try{
    const { id } = req.body; // Obtener ID del body en lugar de params

    const user = await prisma.user.findUnique({
      where: { id: id } // Usar 'id' en lugar de 'cedula'
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        exists: false,
        error: 'Usuario no encontrado con el documento de identidad proporcionado' 
      });
    } else {
      return res.status(200).json({
        success: true,
        exists: true,
        message: 'Usuario encontrado',
        user: {
          id: user.id,
          name: user.name,
          gender: user.gender,
          career: user.career
        }
      });
    }

  } catch(error){  
    console.error('Error en /api/ced:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    const { name, gender, career, cedula } = req.body;
    const imagePath = req.file.path;
    const logopath = path.join(__dirname, 'assets','logo.png');

    const prompt = gender === 'female'
      ? `
        Edit the image, based on the reference. The image is of me in the picture smiling while holding my graduation diploma with the logo that i provide to you and the name ${name}, additionally two signatures in the bottom right corner and left corner. I am standing in a well-kept garden in front of a circular water fountain. Behind me is a modern multi-story building with large windows, likely a university campus. I am 5 years older dressed elegantly in a formal dress with subtle details, looking professional and confident for my graduation ceremony.

        The diploma I am holding shows that I graduated as a ${career} from the Escuela Colombiana de Ingeniería Julio Garavito in Colombia. My name, visible on the diploma, is ${name}.

        In the background, there are flowering bushes, which, together with the modern building, create a solemn and pleasant atmosphere—perfect for a graduation ceremony. My posture, elegant attire, and the way I proudly hold the diploma reflect my happiness and pride in this academic achievement.`

      : `
        Edit the image, based on the reference. The image is of me in the picture smiling while holding my graduation diploma with the logo that i provide to you and the name ${name}, additionally two signatures in the bottom right corner and left corner. I am standing in a well-kept garden in front of a circular water fountain. Behind me is a modern multi-story building with large windows, likely a university campus. I am 5 years older dressed formally in a white dress shirt with small dark dots, a blue tie with white dots, a dark blue suit jacket, and matching pants.

        The diploma I am holding shows that I graduated as a ${career} from the Escuela Colombiana de Ingeniería Julio Garavito in Colombia. My name, visible on the diploma, is ${name}.

        In the background, there are flowering bushes, which, together with the modern building, create a solemn and pleasant atmosphere—perfect for a graduation ceremony. My posture, formal attire, and the way he proudly holds the diploma reflect my happiness and pride in this academic achievement.`;

    const imageUSer = await toFile(fs.createReadStream(imagePath), null, {
      type: "image/png",
    });676

    const imageLogo = await toFile(fs.createReadStream(logopath), null, {
        type: "image/png"
     })

    const result = await openai.images.edit({
      model: "gpt-image-1",
      image: [imageUSer, imageLogo] ,
      prompt: prompt,
    });


    const image_base64 = result.data[0].b64_json;
    const outputBuffer = Buffer.from(image_base64, 'base64');
    const outputFilename = `generated_${Date.now()}.png`;

    // Subir a S3
    const s3Key = await uploadImageToS3(outputBuffer, outputFilename);

    const savedUser = await prisma.user.create({
      data: {
        id: cedula || `temp_${Date.now()}`,
        name,
        gender,
        career,
        image: s3Key, // Guardar Key de S3
      },
    });

    const signedUrl = await getSignedImageUrl(s3Key);
    res.json({ success: true, imagePath: s3Key, user: savedUser, image: signedUrl });

    // Limpiar archivo temporal de upload
    fs.unlinkSync(imagePath);

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Nuevo endpoint para verificar y obtener/generar foto por cédula
app.post('/api/photo/:cedula', upload.single('image'), async (req, res) => {
  try {
    const { cedula } = req.params;
    
    // Buscar el usuario en la base de datos
    const user = await prisma.user.findUnique({
      where: { id: cedula }
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'Usuario no encontrado con la documento de identidad proporcionado' 
      });
    }


    // Si el usuario ya tiene foto (Nombre de archivo en S3), generar URL firmada
    if (user.image) {
      
      const signedUrl = await getSignedImageUrl(user.image);

      return res.json({
        success: true,
        hasExistingPhoto: true,
        user: {
          id: user.id,
          name: user.name,
          gender: user.gender,
          career: user.career
        },
        hasPhoto: true,
        image: signedUrl // Retornar URL firmada temporal
      });
    }

    // Si no tiene foto, verificar si se envió una imagen para generar
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Usuario no tiene foto y no se proporcionó imagen para generar una nueva'
      });
    }


    
    // Generar nueva foto usando los datos del usuario y Gemini
    const imagePath = req.file.path;
    const backgroundPath = path.join(__dirname, 'assets', 'background.png');
    const diplomaPath = path.join(__dirname, 'assets', 'diploma.png');

    // Llamar al servicio de Gemini (Flash para edición)
    const outputBuffer = await generateGraduationImageFlash(
      imagePath, 
      backgroundPath,
      diplomaPath,
      user.gender, 
      user.name, 
      user.career
    );

    const outputFilename = `${user.name.replace(/\s+/g, '_')}_graduado_${Date.now()}.png`;

    // Subir a S3 (ahora devuelve solo el filename/key)
    const s3Key = await uploadImageToS3(outputBuffer, outputFilename);

    // Actualizar usuario en la base de datos con la nueva imagen (Key)
    const updatedUser = await prisma.user.update({
      where: { id: cedula },
      data: { image: s3Key }
    });

    
    // Generar URL firmada para mostrarla inmediatamente
    const signedUrl = await getSignedImageUrl(s3Key);

    res.json({ 
      success: true, 
      hasExistingPhoto: false,
      generated: true,
      imagePath: s3Key,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        gender: updatedUser.gender,
        career: updatedUser.career
      },
      image: signedUrl // Retornar URL firmada
    });

    // Limpiar archivo temporal de upload
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

  } catch (error) {
    console.error('Error en /api/photo/:cedula:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para solo verificar si un usuario tiene foto (sin generar)
app.get('/api/check-photo/:cedula', async (req, res) => {
  try {
    const { cedula } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: cedula },
      select: {
        id: true,
        name: true,
        gender: true,
        career: true,
        image: true
      }
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'Usuario no encontrado' 
      });
    }

    const hasPhoto = !!user.image;
    const response = {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        gender: user.gender,
        career: user.career
      },
      hasPhoto
    };


    // Si tiene foto, incluirla en la respuesta (ahora es una URL firmada)
    if (hasPhoto) {
       response.image = await getSignedImageUrl(user.image);
    }

    res.json(response);

  } catch (error) {
    console.error('Error en /api/check-photo/:cedula:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint de diagnóstico para verificar el formato de imagen almacenada
app.get('/api/debug-image/:cedula', async (req, res) => {
  try {
    const { cedula } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: cedula },
      select: {
        id: true,
        name: true,
        image: true
      }
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'Usuario no encontrado' 
      });
    }

    if (!user.image) {
      return res.json({
        success: true,
        hasImage: false,
        user: { id: user.id, name: user.name }
      });
    }


    // Información de diagnóstico
    const diagnosticInfo = {
      success: true,
      hasImage: true,
      user: { id: user.id, name: user.name },
      imageType: typeof user.image,
      imageValue: user.image // Ver el valor directamente (URL)
    };

    res.json(diagnosticInfo);

  } catch (error) {
    console.error('Error en debug-image:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// IMPORTANTE: Catch-all para servir React (debe ir al final, después de todas las rutas API)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
});
