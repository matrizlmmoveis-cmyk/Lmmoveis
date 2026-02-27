const fs = require('fs');
const PDFParser = require('pdf2json');

const pdfParser = new PDFParser(this, 1);

pdfParser.on('pdfParser_dataError', errData => console.error(errData.parserError));
pdfParser.on('pdfParser_dataReady', pdfData => {
    fs.writeFileSync('pdf_text.txt', pdfParser.getRawTextContent());
    console.log('Extração concluída em pdf_text.txt');
});

pdfParser.loadPDF('saldo_norte.xlsx'); // This is actually the PDF file you downloaded
