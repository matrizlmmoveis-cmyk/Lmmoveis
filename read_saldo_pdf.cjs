const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('saldo_norte.xlsx'); // This is the PDF

pdf(dataBuffer).then(function (data) {
    fs.writeFileSync('pdf_text.txt', data.text);
    console.log("PDF lido com sucesso e salvo em pdf_text.txt");
}).catch(err => {
    console.error("Erro ao ler PDF:", err);
});
