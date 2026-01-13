import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

// Cambia este nombre por el nombre real de tu archivo en la carpeta data/
const FILE_NAME = 'Reporte_Graduados.xlsx'; 
const filePath = path.join(process.cwd(), 'data', FILE_NAME);

if (!fs.existsSync(filePath)) {
    console.error(`❌ No se encontró el archivo: ${filePath}`);
    console.log("Por favor, asegúrate de colocar el archivo Excel en la carpeta 'data/'.");
    process.exit(1);
}

const workbook = XLSX.readFile(filePath);
const targetSheet = 'Nuevos';

if (!workbook.Sheets[targetSheet]) {
    console.error(`❌ No se encontró la hoja llamada '${targetSheet}' en el Excel.`);
    console.log("Hojas disponibles:", workbook.SheetNames.join(', '));
    process.exit(1);
}

const data = XLSX.utils.sheet_to_json(workbook.Sheets[targetSheet]);

console.log(`-- SQL INSERT STATEMENTS --\n`);
console.log(`INSERT INTO "User" (id, name, gender, career, "createdAt") VALUES`);

const values = data.map(row => {
    // 1. Unir Nombre
    const n1 = row['1° Nombre'] || '';
    const n2 = row['2º Nombre'] || '';
    const a1 = row['1° Apellido'] || '';
    const a2 = row['2º Apellido'] || '';
    const fullName = `${n1} ${n2} ${a1} ${a2}`.replace(/\s+/g, ' ').trim();

    // 2. Obtener otros datos y limpiar comillas simples que rompen SQL
    const id = String(row['ID Estudiante']).trim();
    // Normalizar sexo: 'Femenino' -> 'female', 'Masculino' -> 'male' (Ajustar según tu DB)
    let gender = row['Sexo'] || '';
    if (gender.toLowerCase().startsWith('f')) gender = 'female';
    else if (gender.toLowerCase().startsWith('m')) gender = 'male';

    const career = (row['Programa Académico'] || '').replace(/'/g, "''"); // Escape single quotes

    // 3. Formatear para SQL
    return `('${id}', '${fullName.replace(/'/g, "''")}', '${gender}', '${career}')`;
}).join(',\n');

console.log(values);
console.log(`ON CONFLICT (id) DO NOTHING;`);
