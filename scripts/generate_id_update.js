import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

// CONFIGURACIÓN
const FILE_NAME = 'Reporte_Graduados.xlsx'; 
const SHEET_NAME = 'Nuevos'; // Asegúrate que sea la hoja correcta
const COL_OLD_ID = 'ID Estudiante';      // El ID actual en la BD
const COL_NEW_ID = 'Documento Identidad'; // El nuevo ID que quieres poner

const filePath = path.join(process.cwd(), 'data', FILE_NAME);

if (!fs.existsSync(filePath)) {
    console.error(`❌ No se encontró el archivo: ${filePath}`);
    process.exit(1);
}

const workbook = XLSX.readFile(filePath);

// Usar la primera hoja automáticamente
const sheetName = workbook.SheetNames[0];
const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

console.log(`-- Usando hoja: ${sheetName} --`);
// console.log('-- INICIO DE TRANSACCIÓN PARA ACTUALIZACIÓN DE IDS --');
// console.log('BEGIN;'); // Quitamos la transacción global para que no haga rollback de todo si falla uno

let count = 0;

data.forEach(row => {
    const oldId = row[COL_OLD_ID];
    const newId = row[COL_NEW_ID];

    // Validar que ambos datos existan
    if (oldId && newId) {
        // Convertir a string y limpiar espacios
        const oldIdStr = String(oldId).trim();
        const newIdStr = String(newId).trim();

        if (oldIdStr !== newIdStr) {
            // Generar Query en bloque DO para manejar excepciones individualmente
            console.log(`
DO $$ 
BEGIN 
    UPDATE "User" SET id = '${newIdStr}' WHERE id = '${oldIdStr}';
EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE 'Error actualizando ID ${oldIdStr} a ${newIdStr}: %', SQLERRM;
END $$;`);
            count++;
        }
    }
});

// console.log('COMMIT;');
console.log(`-- Generadas ${count} instrucciones de actualización --`);
