
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfData {
    text: string;
    numpages: number;
  }

  function pdfParse(buffer: Buffer): Promise<PdfData>;

  export default pdfParse;
}
