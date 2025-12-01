// Global types provided by external scripts
declare global {
  interface Window {
    protobuf: any;
    SVGA: any;
    pako: any;
  }
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SvgaData {
  version: string;
  params: {
    viewBoxWidth: number;
    viewBoxHeight: number;
    fps: number;
    frames: number;
  };
  sprites: any[];
  // Images are stored as Base64 strings to ensure compatibility with ProtobufJS toObject/fromObject defaults
  images: Record<string, string>; 
}

export interface ProcessedSvga {
  buffer: ArrayBuffer;
  data: SvgaData;
  url: string;
  filename: string;
}

export type AnimationPreset = 'none' | 'pulse' | 'float' | 'shine';

export interface AnimationConfig {
    cycles: number;
    intensity: number;
}

export type Language = 'en' | 'zh';
