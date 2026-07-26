declare module 'pdf-parse' {
  const pdfParse: any;
  export default pdfParse;
}

declare module 'mammoth' {
  export function extractRawText(input: any): Promise<any>;
}

declare module 'xlsx' {
  export const read: any;
  export const utils: any;
}
