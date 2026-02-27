const xlsx = require('xlsx');

const workbook = xlsx.readFile('saldo_norte.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

console.log("Colunas:", data[0]);
console.log("Linha 1:", data[1]);
console.log("Total de linhas:", data.length);
