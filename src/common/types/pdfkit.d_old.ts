declare module 'pdfkit' {
  import { Writable } from 'stream';

  interface PDFDocumentOptions {
    margin?: number;
    margins?: { top: number; bottom: number; left: number; right: number };
    size?: string | [number, number];
    layout?: 'portrait' | 'landscape';
  }

  interface PDFTextOptions {
    align?: 'left' | 'center' | 'right' | 'justify';
    width?: number;
    height?: number;
    continued?: boolean;
  }

  class PDFDocument extends Writable {
    constructor(options?: PDFDocumentOptions);
    fontSize(size: number): this;
    font(name: string): this;
    text(text: string, options?: PDFTextOptions): this;
    text(text: string, x: number, y: number, options?: PDFTextOptions): this;
    moveDown(lines?: number): this;
    addPage(options?: PDFDocumentOptions): this;
    end(): void;
    y: number;
    on(event: string, callback: (...args: any[]) => void): this;
  }

  export default PDFDocument;
}
