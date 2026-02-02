
import { SVGA_PROTO_JSON } from "../constants";
import { Rect, SvgaData, AnimationConfig, AnimationPreset } from "../types";

let svgaRoot: any = null;

// Initialize Protobuf Root
const getSvgaRoot = () => {
  if (!svgaRoot && window.protobuf) {
    svgaRoot = window.protobuf.Root.fromJSON(SVGA_PROTO_JSON);
  }
  return svgaRoot;
};

// Helper to convert Uint8Array to Base64 string
const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

// Helper to fix Base64 padding
const fixBase64Padding = (str: string): string => {
    return str + "=".repeat((4 - (str.length % 4)) % 4);
};

// Helper to convert Base64 string to Uint8Array with robustness
const base64ToUint8Array = (base64: string): Uint8Array => {
    try {
        // Strip potential data URI prefix if present (safety check)
        const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
        const paddedBase64 = fixBase64Padding(cleanBase64.trim());
        const binary_string = window.atob(paddedBase64);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes;
    } catch (e) {
        console.error("Base64 decode error", e);
        return new Uint8Array(0);
    }
};

// Helper: Sanitize Image Keys for File System Compatibility (Mobile)
const sanitizeKey = (key: string): string => {
    if (!key) return "";
    return key.replace(/[^a-zA-Z0-9_\-]/g, "_"); 
};

// EPSILON STRATEGY (Refined)
const forceNonZero = (val: any, def: number = 0): number => {
    let n = typeof val === 'number' ? val : def;
    if (Math.abs(n) <= 1e-5) return 0.00001; 
    return n;
};

// SAFE FLOAT
const safeFloat = (val: any, def: number = 0): number => {
    return typeof val === 'number' ? val : def;
};

// 1x1 Transparent PNG bytes for fallback
const FALLBACK_PNG = new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0,
    0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 1, 115, 82, 71, 66, 0, 174,
    206, 28, 233, 0, 0, 0, 4, 103, 65, 77, 65, 0, 0, 177, 143, 11, 252, 97, 5, 0,
    0, 0, 9, 112, 72, 89, 115, 0, 0, 14, 195, 0, 0, 14, 195, 1, 199, 111, 168,
    100, 0, 0, 0, 13, 73, 68, 65, 84, 24, 87, 99, 248, 255, 255, 255, 127, 0, 9,
    251, 2, 213, 14, 19, 240, 60, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);

export const decodeSvga = async (buffer: ArrayBuffer): Promise<SvgaData> => {
  const root = getSvgaRoot();
  if (!root) throw new Error("Protobuf library not loaded");
  if (!window.pako) throw new Error("Compression library (pako) not loaded");

  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  
  let u8Arr = new Uint8Array(buffer);
  
  if (u8Arr[0] === 0x50 && u8Arr[1] === 0x4B) {
      throw new Error("ZIP-based SVGA (v1.x) files are not currently supported. Please use SVGA 2.0 files.");
  }

  let decompressed = false;
  try {
      u8Arr = window.pako.inflate(u8Arr);
      decompressed = true;
  } catch (e) {
      try {
          u8Arr = window.pako.inflateRaw(u8Arr);
          decompressed = true;
      } catch (e2) {
          console.warn("SVGA decompression failed or file is uncompressed. Attempting to parse raw.");
      }
  }

  const cleanBuffer = new Uint8Array(u8Arr);

  try {
      const message = MovieEntity.decode(cleanBuffer);
      const object = MovieEntity.toObject(message, {
        defaults: true,
        arrays: true,
        objects: true,
        oneofs: true,
        bytes: String, 
      });
      return object as SvgaData;
  } catch (error: any) {
      console.error("Protobuf Decode Error:", error);
      let msg = "Failed to decode SVGA Protobuf structure.";
      if (!decompressed) msg += " The file might be compressed in an unsupported format or corrupted.";
      throw new Error(`${msg} Details: ${error.message}`);
  }
};

// --- SANITIZATION HELPERS ---

const sanitizeRGBA = (color: any) => ({
    r: safeFloat(color?.r, 0),
    g: safeFloat(color?.g, 0),
    b: safeFloat(color?.b, 0),
    a: safeFloat(color?.a, 0),
});

const sanitizeTransform = (t: any) => ({
    a: safeFloat(t?.a, 1),
    b: safeFloat(t?.b, 0),
    c: safeFloat(t?.c, 0),
    d: safeFloat(t?.d, 1),
    tx: forceNonZero(t?.tx, 0),
    ty: forceNonZero(t?.ty, 0),
});

const sanitizeLayout = (l: any) => ({
    x: forceNonZero(l?.x, 0),
    y: forceNonZero(l?.y, 0),
    width: forceNonZero(l?.width, 0),
    height: forceNonZero(l?.height, 0),
});

const sanitizeShape = (shape: any): any => {
    let type = shape.type || 0;
    if (type === 0 && (!shape.shape || !shape.shape.d)) type = 3; 
    const cleanShape: any = { type };

    if (shape.shape) cleanShape.shape = { d: shape.shape.d || "" };
    if (shape.rect) cleanShape.rect = { x: safeFloat(shape.rect.x), y: safeFloat(shape.rect.y), width: safeFloat(shape.rect.width), height: safeFloat(shape.rect.height), cornerRadius: safeFloat(shape.rect.cornerRadius) };
    if (shape.ellipse) cleanShape.ellipse = { x: safeFloat(shape.ellipse.x), y: safeFloat(shape.ellipse.y), radiusX: safeFloat(shape.ellipse.radiusX), radiusY: safeFloat(shape.ellipse.radiusY) };
    if (shape.styles) cleanShape.styles = { fill: shape.styles.fill ? sanitizeRGBA(shape.styles.fill) : undefined, stroke: shape.styles.stroke ? sanitizeRGBA(shape.styles.stroke) : undefined, strokeWidth: safeFloat(shape.styles.strokeWidth), lineCap: shape.styles.lineCap || 0, lineJoin: shape.styles.lineJoin || 0, miterLimit: safeFloat(shape.styles.miterLimit), lineDash: Array.isArray(shape.styles.lineDash) ? shape.styles.lineDash.map((v:any) => safeFloat(v)) : [] };
    if (shape.transform) cleanShape.transform = sanitizeTransform(shape.transform);

    return cleanShape;
};

export const encodeSvga = (data: SvgaData, compress: boolean = true): Uint8Array => {
  const root = getSvgaRoot();
  if (!root) throw new Error("Protobuf library not loaded");
  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  
  const encodedImages: Record<string, Uint8Array> = {};
  const validImageKeys = new Set<string>();
  const keyMapping: Record<string, string> = {}; 

  if (data.images) {
      for (const key in data.images) {
          const safeKey = sanitizeKey(key);
          keyMapping[key] = safeKey;
          const val = data.images[key] as any;
          if (typeof val === 'string') {
               const bytes = base64ToUint8Array(val);
               encodedImages[safeKey] = bytes.length > 0 ? bytes : FALLBACK_PNG;
               validImageKeys.add(safeKey);
          } else if (val instanceof Uint8Array) {
               encodedImages[safeKey] = val;
               validImageKeys.add(safeKey);
          }
      }
  }

  const encodedSprites = (data.sprites || []).map((sprite: any) => {
      let imageKey = sprite.imageKey || "";
      if (imageKey && keyMapping[imageKey]) imageKey = keyMapping[imageKey];
      if (imageKey && !validImageKeys.has(imageKey)) {
          console.warn(`Fixing missing image reference: ${imageKey}`);
          encodedImages[imageKey] = FALLBACK_PNG;
          validImageKeys.add(imageKey);
      }
      return {
        imageKey: imageKey,
        matteKey: sprite.matteKey || "",
        frames: (sprite.frames || []).map((frame: any) => ({
            alpha: safeFloat(frame.alpha, 1),
            clipPath: frame.clipPath || "",
            layout: frame.layout ? sanitizeLayout(frame.layout) : sanitizeLayout({}), 
            transform: frame.transform ? sanitizeTransform(frame.transform) : sanitizeTransform({}),
            shapes: (frame.shapes || []).map(sanitizeShape)
        }))
      };
  });

  const encodedAudios = (data['audios'] || []).map((audio: any) => ({
      audioKey: sanitizeKey(audio.audioKey || ""),
      startFrame: Math.round(audio.startFrame || 0),
      endFrame: Math.round(audio.endFrame || 0),
      startTime: Math.round(audio.startTime || 0),
      totalTime: Math.round(audio.totalTime || 0)
  }));

  const payload = {
      version: "2.0", 
      params: {
          viewBoxWidth: safeFloat(data.params?.viewBoxWidth, 800),
          viewBoxHeight: safeFloat(data.params?.viewBoxHeight, 800),
          fps: Math.round(data.params?.fps || 20),
          frames: Math.round(data.params?.frames || 0)
      },
      images: encodedImages,
      sprites: encodedSprites,
      audios: encodedAudios
  };

  const message = MovieEntity.fromObject(payload);
  const buffer = MovieEntity.encode(message).finish();
  if (compress && window.pako) return window.pako.deflate(buffer, { level: 6 });
  return buffer;
};

// Generates a transparent PNG matching target dimensions
const generatePlaceholderPng = async (width: number, height: number): Promise<Uint8Array> => {
    return new Promise((resolve) => {
        const w = Math.ceil(width) || 1;
        const h = Math.ceil(height) || 1;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.toBlob((blob) => {
            if (blob) blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
            else resolve(FALLBACK_PNG);
        }, 'image/png');
    });
};

// Generates a PALE GOLD GRADIENT RECT PNG (used for shine placeholder of Key layers)
const generatePaleGoldRectPng = async (width: number, height: number): Promise<Uint8Array> => {
    return new Promise((resolve) => {
        const w = Math.ceil(width) || 1;
        const h = Math.ceil(height) || 1;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(FALLBACK_PNG); return; }
        
        // Pale Gold/White Gradient
        const gradient = ctx.createLinearGradient(0, 0, w, h);
        gradient.addColorStop(0, '#FFFFFF'); 
        gradient.addColorStop(0.3, '#FFF8E1'); // Pale Amber
        gradient.addColorStop(0.5, '#FFFFFF'); 
        gradient.addColorStop(0.7, '#FFF8E1'); 
        gradient.addColorStop(1, '#FFFFFF');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
        
        // Add Bloom
        ctx.filter = 'blur(4px)';
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'none';

        canvas.toBlob((blob) => {
            if (blob) blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
            else resolve(FALLBACK_PNG);
        }, 'image/png');
    });
};

// Generate PALE GOLD/WHITE Silhouette with BLUR (Glowing Effect)
const generatePaleGoldSilhouette = async (baseBytes: Uint8Array, width: number, height: number): Promise<Uint8Array> => {
    return new Promise((resolve) => {
        const img = new Image();
        const blob = new Blob([baseBytes], { type: 'image/png' });
        img.onload = () => {
             const w = Math.ceil(width);
             const h = Math.ceil(height);
             const canvas = document.createElement('canvas');
             canvas.width = w;
             canvas.height = h;
             const ctx = canvas.getContext('2d');
             if (!ctx) { resolve(FALLBACK_PNG); return; }

             ctx.clearRect(0, 0, w, h);
             
             // 1. Draw base image
             ctx.drawImage(img, 0, 0, w, h);
             
             // 2. Composite Pale Gold/White Gradient
             ctx.globalCompositeOperation = 'source-in';
             const gradient = ctx.createLinearGradient(0, 0, w, h);
             gradient.addColorStop(0, '#FFFFFF'); 
             gradient.addColorStop(0.2, '#FFE082'); // Light Amber
             gradient.addColorStop(0.5, '#FFFFFF'); // Bright White Center
             gradient.addColorStop(0.8, '#FFE082'); 
             gradient.addColorStop(1, '#FFFFFF');
             ctx.fillStyle = gradient;
             ctx.fillRect(0, 0, w, h);
             
             // 3. Create a glow copy
             const tempCanvas = document.createElement('canvas');
             tempCanvas.width = w;
             tempCanvas.height = h;
             const tempCtx = tempCanvas.getContext('2d');
             if (tempCtx) {
                 tempCtx.drawImage(canvas, 0, 0);
                 ctx.globalCompositeOperation = 'source-over';
                 ctx.clearRect(0, 0, w, h);
                 ctx.filter = 'blur(2px)'; // Slight blur for glow/feathering
                 ctx.drawImage(tempCanvas, 0, 0);
                 ctx.filter = 'none';
             }

             canvas.toBlob((b) => {
                 if (b) b.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
                 else resolve(FALLBACK_PNG);
             }, 'image/png');
             URL.revokeObjectURL(img.src);
        };
        img.onerror = () => resolve(FALLBACK_PNG);
        img.src = URL.createObjectURL(blob);
    });
};

export const calcTextSize = (text: string, fontSize: number, fontFamily: string = "sans-serif") => {
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    if (!measureCtx) return { width: 0, height: 0 };
    measureCtx.font = `bold ${fontSize}px "${fontFamily}", sans-serif`;
    const metrics = measureCtx.measureText(text);
    const height = Math.ceil(fontSize * 1.2); 
    const width = Math.ceil(metrics.width + 4); 
    return { width, height };
};

export const generateTextBitmap = async (
    text: string, 
    fontSize: number, 
    fontFamily: string,
    width: number, 
    height: number,
    colorOrGradientStart: string,
    isGradient: boolean = false,
    gradientEnd: string = "#ffffff"
): Promise<Uint8Array> => {
    // Wait for the font to be ready in the browser before drawing to the canvas
    if (document.fonts) {
        try {
            const fontSpec = `bold ${fontSize}px "${fontFamily}"`;
            await document.fonts.load(fontSpec);
        } catch (e) {
            console.warn("Font loading failed, falling back to system fonts:", fontFamily);
        }
    }

    return new Promise((resolve) => {
        const w = Math.ceil(width);
        const h = Math.ceil(height);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(FALLBACK_PNG); return; }

        ctx.clearRect(0, 0, w, h);
        ctx.font = `bold ${fontSize}px "${fontFamily}", sans-serif`;
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        const textHeight = fontSize * 1.2;

        const scaleX = w / textWidth;
        const scaleY = h / textHeight;
        const fitScale = Math.min(scaleX, scaleY, 1);

        ctx.translate(w / 2, h / 2);
        ctx.scale(fitScale, fitScale);
        ctx.textBaseline = 'middle'; 
        ctx.textAlign = 'center';

        if (isGradient) {
            const halfH = textHeight / 2;
            const gradient = ctx.createLinearGradient(0, -halfH, 0, halfH);
            gradient.addColorStop(0, colorOrGradientStart);
            gradient.addColorStop(1, gradientEnd);
            ctx.fillStyle = gradient;
        } else {
            ctx.fillStyle = colorOrGradientStart;
        }

        ctx.fillText(text, 0, 0);

        canvas.toBlob((blob) => {
            if (blob) blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
            else resolve(FALLBACK_PNG);
        }, 'image/png');
    });
};

export const processUploadedImage = async (file: File, targetWidth: number, targetHeight: number): Promise<Uint8Array> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
             const w = Math.ceil(targetWidth);
             const h = Math.ceil(targetHeight);
             const canvas = document.createElement('canvas');
             canvas.width = w;
             canvas.height = h;
             const ctx = canvas.getContext('2d');
             if (!ctx) { resolve(FALLBACK_PNG); return; }

             ctx.clearRect(0, 0, w, h);
             const imgRatio = img.width / img.height;
             const targetRatio = w / h;
             let drawW, drawH, offsetX, offsetY;
             
             if (imgRatio > targetRatio) {
                 drawW = w;
                 drawH = w / imgRatio;
                 offsetX = 0;
                 offsetY = (h - drawH) / 2;
             } else {
                 drawH = h;
                 drawW = h * imgRatio;
                 offsetX = (w - drawW) / 2;
                 offsetY = 0;
             }
             ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
             canvas.toBlob((blob) => {
                 if (blob) blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
                 else resolve(FALLBACK_PNG);
             }, 'image/png');
             URL.revokeObjectURL(img.src);
        };
        img.onerror = () => resolve(FALLBACK_PNG);
        img.src = URL.createObjectURL(file);
    });
};

export const reprocessImageTo32BitPng = async (base64OrUrl: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
             const canvas = document.createElement('canvas');
             canvas.width = img.width;
             canvas.height = img.height;
             const ctx = canvas.getContext('2d');
             if(!ctx) { resolve(base64OrUrl); return; }
             ctx.clearRect(0,0, canvas.width, canvas.height);
             ctx.drawImage(img, 0, 0);
             const dataUrl = canvas.toDataURL('image/png');
             const base64 = dataUrl.split(',')[1];
             resolve(base64);
        };
        img.onerror = () => resolve(base64OrUrl);
        if (base64OrUrl.startsWith('data:')) img.src = base64OrUrl;
        else img.src = 'data:image/png;base64,' + base64OrUrl;
    });
};

export const sanitizeImagesTo32Bit = async (images: Record<string, string>): Promise<Record<string, string>> => {
    const processed: Record<string, string> = {};
    const keys = Object.keys(images);
    await Promise.all(keys.map(async (key) => {
        try {
            processed[key] = await reprocessImageTo32BitPng(images[key]);
        } catch (e) {
            processed[key] = images[key];
        }
    }));
    return processed;
};

export const addPlaceholderToSvga = async (
  svgaData: SvgaData,
  rect: Rect, 
  keyName: string,
  customImageBytes?: Uint8Array, 
  animations: AnimationPreset[] = [], // Changed to Array
  animConfig: AnimationConfig = { cycles: 1, intensity: 1 }
): Promise<SvgaData> => {
  // Use custom bytes if provided, otherwise generate transparent PNG of exact size
  let pngBytes = customImageBytes;
  if (!pngBytes) {
      pngBytes = await generatePlaceholderPng(rect.width, rect.height);
  }
  
  const safeKeyName = sanitizeKey(keyName);
  const newImages = svgaData.images ? { ...svgaData.images } : {};
  const totalFrames = svgaData.params?.frames || 0;
  const mainFrames = [];
  const spritesToAdd = [];
  const { cycles, intensity } = animConfig;

  const imageBase64 = uint8ArrayToBase64(pngBytes);
  newImages[safeKeyName] = imageBase64;
  
  // 1. Main Sprite (Combine Transform Animations: Pulse + Float)
  for (let i = 0; i < totalFrames; i++) {
    if (rect.width <= 0 || rect.height <= 0) {
            mainFrames.push({ alpha: 0, layout: {}, transform: {} });
            continue;
    }
    
    let animScale = 1; 
    let animY = 0;
    const progress = totalFrames > 0 ? i / totalFrames : 0; 
    const PI2 = Math.PI * 2;
    
    // Apply Pulse
    if (animations.includes('pulse')) {
        animScale *= (1 + Math.sin(progress * PI2 * cycles) * (0.05 * intensity));
    }
    
    // Apply Float
    if (animations.includes('float')) {
        animY += Math.sin(progress * PI2 * cycles) * (6 * intensity);
    }

    mainFrames.push({
        alpha: 1,
        layout: { x: 0, y: 0, width: rect.width, height: rect.height },
        transform: { 
            a: animScale, d: animScale, 
            tx: rect.x + (rect.width * (1-animScale))/2, 
            ty: rect.y + (rect.height * (1-animScale))/2 + animY 
        }
    });
  }
  
  spritesToAdd.push({
    imageKey: safeKeyName,
    frames: mainFrames,
    matteKey: ""
  });

  // 2. Shine Sprite (Improved: Static Sprite + Multi-Layer ClipPath Animation for Feathering)
  if (animations.includes('shine')) {
      let shineBytes: Uint8Array;
      
      // If we have content (text/image), generate a PALE GOLD silhouette with BLUR.
      if (customImageBytes && customImageBytes.length > 0) {
          shineBytes = await generatePaleGoldSilhouette(customImageBytes, rect.width, rect.height);
      } else {
          // For Key placeholders without content, use a solid PALE GOLD block
          shineBytes = await generatePaleGoldRectPng(rect.width, rect.height);
      }
      
      const shineKey = `${safeKeyName}_shine`;
      newImages[shineKey] = uint8ArrayToBase64(shineBytes);
      
      // Multi-layer clip path to simulate soft edge
      const layers = [
          { offset: -rect.width * 0.05, alpha: 0.3 }, // Leading
          { offset: 0, alpha: 0.9 }, // Center (Bright)
          { offset: rect.width * 0.05, alpha: 0.3 }, // Trailing
      ];

      const w = rect.width;
      const h = rect.height;
      const tanAngle = 0.577; // tan(30)
      const xOffset = h * tanAngle; 
      const bandWidth = w * (0.4 * intensity); 

      layers.forEach((layer, idx) => {
          const shineFrames = [];
          for (let i = 0; i < totalFrames; i++) {
                let progress = (totalFrames > 0 ? i / totalFrames : 0) * cycles;
                progress = progress % 1.0;
                
                // Calculate Center X of the band (Left to Right Sweep)
                const startX = -bandWidth - xOffset;
                const endX = w + bandWidth + xOffset;
                const cx = startX + (endX - startX) * progress + layer.offset;
                
                // Calculate Polygon Points
                const x1 = cx + xOffset - bandWidth/2; 
                const x2 = cx + xOffset + bandWidth/2; 
                const x3 = cx - xOffset + bandWidth/2; 
                const x4 = cx - xOffset - bandWidth/2; 
                
                const d = `M ${x1} 0 L ${x2} 0 L ${x3} ${h} L ${x4} ${h} Z`;
                
                shineFrames.push({
                    alpha: layer.alpha, 
                    layout: { x: 0, y: 0, width: rect.width, height: rect.height },
                    transform: { a: 1, d: 1, tx: rect.x, ty: rect.y }, 
                    clipPath: d 
                });
          }
          spritesToAdd.push({
              imageKey: shineKey, 
              frames: shineFrames,
              matteKey: "" 
          });
      });
  }

  return {
    ...svgaData,
    images: newImages,
    sprites: [...(svgaData.sprites || []), ...spritesToAdd],
  };
};
