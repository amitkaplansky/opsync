declare module 'pdf-parse' {
  export interface PDFInfo {
    PDFFormatVersion?: string;
    IsAcroFormPresent?: boolean;
    IsXFAPresent?: boolean;
    [k: string]: any;
  }

  export interface PDFMetadata {
    [k: string]: any;
  }

  export interface PDFData {
    numpages: number;
    numrender: number;
    info: PDFInfo;
    metadata?: PDFMetadata;
    text: string;
    version: string;
  }

  export interface PDFOptions {
    pagerender?: (pageData: any) => string | Promise<string>;
    max?: number;
    version?: string;
    [k: string]: any;
  }

  // Works with `esModuleInterop: true` and default import style:
  const pdf: (data: Buffer | Uint8Array, options?: PDFOptions) => Promise<PDFData>;
  export default pdf;
}