import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuración
const TABLE_NAME = 'User'; // Ajusta esto al nombre real de tu tabla
const OUTPUT_FILE = 'insertar_datos.sql';

// Obtener ruta del archivo desde argumentos
const args = process.argv.slice(2);
const excelFilePath = args[0];

if (!excelFilePath) {
    console.error('❌ Error: Debes proporcionar la ruta del archivo Excel.');
    console.error('Uso: node scripts/excel_to_sql.js <ruta_al_excel>');
    process.exit(1);
}

try {
    // Resolver ruta absoluta
    const resolvedPath = path.resolve(excelFilePath);
    
    if (!fs.existsSync(resolvedPath)) {
        console.error(`❌ El archivo no existe: ${resolvedPath}`);
        process.exit(1);
    }

    // Leer el archivo Excel
    console.log(`Leyendo archivo: ${resolvedPath}...`);
    const workbook = XLSX.readFile(resolvedPath);
    const sheetName = workbook.SheetNames[0]; // Usar la primera hoja por defecto
    const worksheet = workbook.Sheets[sheetName];

    // Convertir a JSON
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
        console.log('⚠️ El archivo Excel está vacío o no se pudieron leer datos.');
        process.exit(0);
    }

    console.log(`Procesando ${data.length} registros...`);

    let sqlContent = '';

    // Generar INSERTs
    // Asumimos que la tabla tiene las columnas: id, name, gender, career
    // Mapeamos los campos del Excel a esta estructura
    
    data.forEach(row => {
        const documento = String(row['NUMERO DE DOCUMENTO'] || '').trim();
        
        // Construir nombre completo
        const pNombre = (row['PRIMER NOMBRE'] || '').trim();
        const sNombre = (row['SEGUNDO NOMBRE'] || '').trim();
        const pApellido = (row['PRIMER APELLIDO'] || '').trim();
        const sApellido = (row['SEGUNDO APELLIDO'] || '').trim();
        
        const nombreCompleto = `${pNombre} ${sNombre} ${pApellido} ${sApellido}`.replace(/\s+/g, ' ').trim().replace(/'/g, "''");
        
        const programa = (row['PROGRAMA'] || '').trim().replace(/'/g, "''");
        
        // Normalizar género (ajustar lógica según necesidad)
        let generoRaw = (row['Genero'] || '').trim();
        let genero = generoRaw;
        // Ejemplo de normalización simple si fuera necesario:
        // if (generoRaw.toUpperCase().startsWith('F')) genero = 'FEMENINO';
        // if (generoRaw.toUpperCase().startsWith('M')) genero = 'MASCULINO';
        
        if (documento) {
             // Ajusta los nombres de columnas (id, name, career, gender) a los de tu base de datos real
            sqlContent += `INSERT INTO "${TABLE_NAME}" (id, name, career, gender) VALUES ('${documento}', '${nombreCompleto}', '${programa}', '${genero}');\n`;
        }
    });

    // Escribir archivo SQL
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const outputPath = path.join(__dirname, '..', OUTPUT_FILE);

    fs.writeFileSync(outputPath, sqlContent);

    console.log(`✅ Archivo SQL generado exitosamente: ${outputPath}`);

} catch (error) {
    console.error('❌ Ocurrió un error:', error.message);
}
