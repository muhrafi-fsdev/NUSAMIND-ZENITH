declare module 'pdf-parse' {
  const pdfParse: any;
  export default pdfParse;
}

declare module 'mammoth' {
  export function extractRawText(input: any): Promise<any>;
}
