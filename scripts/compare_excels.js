import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

// Ajusta las rutas a tus archivos reales
const FILE_OLD = 'Listado_Graduandos_Ceremonia_2025-1_V1.xlsx'; // El Excel viejo
const FILE_NEW = 'Reporte_Graduados.xlsx'; // El Nuevo Excel con las columnas separadas

// Lee los archivos (asume que están en la carpeta 'data' o ajusta la ruta)
const pathOld = path.join(process.cwd(), 'data', FILE_OLD);
const pathNew = path.join(process.cwd(), 'data', FILE_NEW);

if (!fs.existsSync(pathOld) || !fs.existsSync(pathNew)) {
    process.exit(1);
}

function readExcelIds(filePath, idColumnName) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    
    // Extraer solo los IDs y convertirlos a String para comparar fácil
    const ids = new Set();
    data.forEach(row => {
        if (row[idColumnName]) {
            ids.add(String(row[idColumnName]).trim());
        }
    });
    return ids;
}

function processNewExcel(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    let data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Unir nombres
    const processedData = data.map(row => {
        // Asumiendo nombres de columnas del nuevo excel:
        // '1° Nombre', '2º Nombre', '1° Apellido', '2º Apellido'
        const n1 = row['1° Nombre'] || '';
        const n2 = row['2º Nombre'] || '';
        const a1 = row['1° Apellido'] || '';
        const a2 = row['2º Apellido'] || '';
        
        // Unir y limpiar espacios dobles
        const fullName = `${n1} ${n2} ${a1} ${a2}`.replace(/\s+/g, ' ').trim();
        
        return {
            ...row,
            'Nombre Completo': fullName // Nueva columna
        };
    });

    return processedData;
}

// 1. Procesar el nuevo Excel para unir nombres
console.log("🔄 Procesando nuevo Excel y uniendo nombres...");
const newData = processNewExcel(pathNew);

// 2. Leer IDs de ambos para comparar
const oldIds = readExcelIds(pathOld, 'ID Estudiante'); // Ajusta el nombre de la columna del viejo si es diferente
const newIds = new Set(newData.map(r => String(r['ID Estudiante'])));

// 3. Comparar
const missingInNew = [...oldIds].filter(id => !newIds.has(id));
const missingInOld = [...newIds].filter(id => !oldIds.has(id));

console.log("\n📊 RESULTADOS DE LA COMPARACIÓN:");
console.log(`Total en Viejo: ${oldIds.size}`);
console.log(`Total en Nuevo: ${newIds.size}`);

if (missingInNew.length > 0) {
    console.log(`\n⚠️  IDs que están en el VIEJO pero NO en el NUEVO (${missingInNew.length}):`);
    console.log(missingInNew.join(', '));
} else {
    console.log("\n✅ Todos los del viejo están en el nuevo.");
}

if (missingInOld.length > 0) {
    console.log(`\n🆕 IDs que están en el NUEVO pero NO en el VIEJO (${missingInOld.length}):`);
    console.log(missingInOld.join(', '));
} else {
    console.log("\n✅ Todos los del nuevo están en el viejo.");
}

// 4. Guardar el nuevo Excel procesado (opcional)
const newWs = XLSX.utils.json_to_sheet(newData);
const newWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(newWb, newWs, "Procesado");
XLSX.writeFile(newWb, path.join(process.cwd(), 'data', 'Reporte_Graduados_Unificado.xlsx'));
console.log("\n💾 Archivo procesado guardado como 'data/Reporte_Graduados_Unificado.xlsx'");
