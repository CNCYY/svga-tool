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
// Replaces slashes, backslashes, and spaces with underscores.
// Now ALLOWS hyphens (-) as they are safe for file systems.
const sanitizeKey = (key: string): string => {
    if (!key) return "";
    return key.replace(/[^a-zA-Z0-9_\-]/g, "_"); // Allow alphanumeric, underscore, and hyphen
};

// EPSILON STRATEGY (Refined):
// Native players (C++/Proto2) often fail if optional fields (like x=0, y=0) are skipped by the encoder.
// We use forceNonZero ONLY for Layout coordinates and Transform translations.
const forceNonZero = (val: any, def: number = 0): number => {
    let n = typeof val === 'number' ? val : def;
    if (Math.abs(n) <= 1e-5) return 0.00001; 
    return n;
};

// SAFE FLOAT:
// For visual properties (Colors, Stroke Width, Params) and Matrix values (Scale/Skew),
// 0 is a valid and distinct value. We should NOT convert 0 to 0.00001 here.
const safeFloat = (val: any, def: number = 0): number => {
    return typeof val === 'number' ? val : def;
};

// 1x1 Transparent PNG bytes for fallback (Strictly valid PNG signature)
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
  
  // Ensure we start with a clean Uint8Array
  let u8Arr = new Uint8Array(buffer);
  
  // Check for ZIP signature (PK..)
  if (u8Arr[0] === 0x50 && u8Arr[1] === 0x4B) {
      throw new Error("ZIP-based SVGA (v1.x) files are not currently supported. Please use SVGA 2.0 files.");
  }

  let decompressed = false;

  try {
      // 1. Try standard Zlib inflate
      u8Arr = window.pako.inflate(u8Arr);
      decompressed = true;
  } catch (e) {
      // 2. If Zlib fails, try Raw Deflate (no header)
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
        bytes: String, // Keep images as Base64 strings in the JS object
      });
      return object as SvgaData;
  } catch (error: any) {
      console.error("Protobuf Decode Error:", error);
      let msg = "Failed to decode SVGA Protobuf structure.";
      if (!decompressed) {
          msg += " The file might be compressed in an unsupported format or corrupted.";
      }
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
    // Transform: Only force tx/ty (position) to exist.
    // Scale (a, d) and Skew (b, c) should use safeFloat to allow true 0/1 values.
    // Forcing 0.00001 on b/c (skew) makes dirty matrices that confuse parsers.
    a: safeFloat(t?.a, 1),
    b: safeFloat(t?.b, 0),
    c: safeFloat(t?.c, 0),
    d: safeFloat(t?.d, 1),
    tx: forceNonZero(t?.tx, 0),
    ty: forceNonZero(t?.ty, 0),
});

const sanitizeLayout = (l: any) => ({
    // Layout: Force ALL fields to be non-zero (epsilon).
    // Native mobile parsers (iOS/Android) often treat missing Layout fields (0 defaults) as malformed data.
    // Writing 0.00001 ensures the field is present in the binary.
    x: forceNonZero(l?.x, 0),
    y: forceNonZero(l?.y, 0),
    width: forceNonZero(l?.width, 0),
    height: forceNonZero(l?.height, 0),
});

const sanitizeShape = (shape: any): any => {
    let type = shape.type || 0;
    
    // Safety check: If type is SHAPE (0) but 'd' is empty, force to KEEP (3)
    if (type === 0 && (!shape.shape || !shape.shape.d)) {
        type = 3; 
    }

    const cleanShape: any = { type };

    // Handle OneOf Args
    if (shape.shape) {
        cleanShape.shape = { d: shape.shape.d || "" };
    }
    if (shape.rect) {
        cleanShape.rect = {
            x: safeFloat(shape.rect.x),
            y: safeFloat(shape.rect.y),
            width: safeFloat(shape.rect.width),
            height: safeFloat(shape.rect.height),
            cornerRadius: safeFloat(shape.rect.cornerRadius)
        };
    }
    if (shape.ellipse) {
        cleanShape.ellipse = {
            x: safeFloat(shape.ellipse.x),
            y: safeFloat(shape.ellipse.y),
            radiusX: safeFloat(shape.ellipse.radiusX),
            radiusY: safeFloat(shape.ellipse.radiusY)
        };
    }

    // Styles
    if (shape.styles) {
        cleanShape.styles = {
            fill: shape.styles.fill ? sanitizeRGBA(shape.styles.fill) : undefined,
            stroke: shape.styles.stroke ? sanitizeRGBA(shape.styles.stroke) : undefined,
            strokeWidth: safeFloat(shape.styles.strokeWidth),
            lineCap: shape.styles.lineCap || 0,
            lineJoin: shape.styles.lineJoin || 0,
            miterLimit: safeFloat(shape.styles.miterLimit),
            lineDash: Array.isArray(shape.styles.lineDash) ? shape.styles.lineDash.map((v:any) => safeFloat(v)) : [] 
        };
    }

    // Transform
    if (shape.transform) {
        cleanShape.transform = sanitizeTransform(shape.transform);
    }

    return cleanShape;
};

export const encodeSvga = (data: SvgaData, compress: boolean = true): Uint8Array => {
  const root = getSvgaRoot();
  if (!root) throw new Error("Protobuf library not loaded");

  const MovieEntity = root.lookupType("com.opensource.svga.MovieEntity");
  
  // --- STRICT SANITIZATION START ---

  // 1. Prepare Images & Sanitize Keys
  const encodedImages: Record<string, Uint8Array> = {};
  const validImageKeys = new Set<string>();
  const keyMapping: Record<string, string> = {}; // Old Key -> New Safe Key

  if (data.images) {
      for (const key in data.images) {
          const safeKey = sanitizeKey(key);
          keyMapping[key] = safeKey;

          const val = data.images[key] as any;
          if (typeof val === 'string') {
               const bytes = base64ToUint8Array(val);
               if (bytes.length > 0) {
                   encodedImages[safeKey] = bytes;
                   validImageKeys.add(safeKey);
               } else {
                   encodedImages[safeKey] = FALLBACK_PNG;
                   validImageKeys.add(safeKey);
               }
          } else if (val instanceof Uint8Array) {
               encodedImages[safeKey] = val;
               validImageKeys.add(safeKey);
          }
      }
  }

  // 2. Prepare Sprites (Deep Copy & Sanitize)
  const encodedSprites = (data.sprites || []).map((sprite: any) => {
      let imageKey = sprite.imageKey || "";
      if (imageKey && keyMapping[imageKey]) {
          imageKey = keyMapping[imageKey];
      }

      // REFERENTIAL INTEGRITY CHECK
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
            // Use sanitizeLayout to force writing x/y/w/h as 0.00001
            layout: frame.layout ? sanitizeLayout(frame.layout) : sanitizeLayout({}), 
            transform: frame.transform ? sanitizeTransform(frame.transform) : sanitizeTransform({}),
            shapes: (frame.shapes || []).map(sanitizeShape)
        }))
      };
  });

  // 3. Prepare Audios
  const encodedAudios = (data['audios'] || []).map((audio: any) => ({
      audioKey: sanitizeKey(audio.audioKey || ""),
      startFrame: Math.round(audio.startFrame || 0),
      endFrame: Math.round(audio.endFrame || 0),
      startTime: Math.round(audio.startTime || 0),
      totalTime: Math.round(audio.totalTime || 0)
  }));

  // 4. Construct Clean Payload
  const payload = {
      version: "2.0", // Explicitly 2.0
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
  // --- STRICT SANITIZATION END ---

  const message = MovieEntity.fromObject(payload);
  const buffer = MovieEntity.encode(message).finish();

  if (compress && window.pako) {
      // Use level 6 for standard Zlib compression (0x78 0x9C).
      return window.pako.deflate(buffer, { level: 6 });
  }
  return buffer;
};

// Generates a transparent PNG matching target dimensions
// Updated to accept width/height to correct 1:1 sizing issues
const generatePlaceholderPng = async (width: number, height: number): Promise<Uint8Array> => {
    return new Promise((resolve) => {
        const w = Math.ceil(width);
        const h = Math.ceil(height);
        const canvas = document.createElement('canvas');
        canvas.width = w > 0 ? w : 1;
        canvas.height = h > 0 ? h : 1;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(FALLBACK_PNG); return; }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
            if (blob) {
                blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
            } else {
                 resolve(FALLBACK_PNG);
            }
        }, 'image/png');
    });
};

// Generates a white tilted sweep bar for shine animation
// Optimized to match target dimensions to prevent distortion of the 30-degree angle
const generateShineBitmap = async (width: number, height: number): Promise<Uint8Array> => {
    return new Promise((resolve) => {
        const w = Math.ceil(width);
        const h = Math.ceil(height);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(FALLBACK_PNG); return; }

        ctx.clearRect(0, 0, w, h);

        ctx.save();
        // Move to center to rotate
        ctx.translate(w / 2, h / 2);
        ctx.rotate(Math.PI / 6); // 30 degrees tilt
        
        // Use exact diagonal length to ensure the bar covers the box without being excessively huge
        const diagonal = Math.sqrt(w*w + h*h);
        const barSize = Math.ceil(diagonal * 1.2); 
        
        // Create gradient centered at 0
        const gradient = ctx.createLinearGradient(-barSize/2, 0, barSize/2, 0);
        
        // "Overlay" simulation: Very sharp peak white with transparency
        // Tightened stops to make the beam sharper and less broad
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.2)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)'); // High intensity peak
        gradient.addColorStop(0.55, 'rgba(255, 255, 255, 0.2)');
        gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        // Draw the bar centered on the rotated axis
        ctx.fillRect(-barSize/2, -barSize/2, barSize, barSize);
        ctx.restore();

        canvas.toBlob((blob) => {
             if (blob) {
                 blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
             } else {
                 resolve(FALLBACK_PNG);
             }
        }, 'image/png');
    });
};

// Helper to load image for baking
const loadImage = async (bytes: Uint8Array): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const blob = new Blob([bytes], { type: 'image/png' });
        img.onload = () => {
            URL.revokeObjectURL(img.src);
            resolve(img);
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(blob);
    });
};

// Helper to bake shine frame
const bakeShineFrame = async (
    baseImg: HTMLImageElement,
    shineImg: HTMLImageElement,
    shineTx: number,
    shineTy: number,
    width: number,
    height: number
): Promise<string> => { // Returns Base64
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return "";

    // 1. Draw Base
    ctx.drawImage(baseImg, 0, 0);

    // 2. Composite Shine
    ctx.globalCompositeOperation = 'source-atop';
    // Translate shine image
    ctx.save();
    ctx.translate(shineTx, shineTy);
    ctx.drawImage(shineImg, 0, 0); // draw shine image at 0,0 relative to translated context
    ctx.restore();

    // 3. Export
    return canvas.toDataURL('image/png').split(',')[1];
};


// Shared measurement canvas
const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d');

// Calculates exact text bounds to prevent clipping and ensure visual accuracy
export const calcTextSize = (text: string, fontSize: number, fontFamily: string = "sans-serif") => {
    if (!measureCtx) return { width: 0, height: 0 };
    measureCtx.font = `bold ${fontSize}px "${fontFamily}", sans-serif`;
    const metrics = measureCtx.measureText(text);
    // Use line-height 1.2 which is standard for most inputs
    const height = Math.ceil(fontSize * 1.2); 
    // Small buffer for anti-aliasing and emojis
    const width = Math.ceil(metrics.width + 4); 
    return { width, height };
};

// Generates a PNG from text with specific styles, scaling down to fit if necessary
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
    return new Promise((resolve) => {
        // Change SCALE to 1 to ensure 1:1 output size as requested by user
        const SCALE = 1; 
        const w = Math.ceil(width * SCALE);
        const h = Math.ceil(height * SCALE);
        const baseFontSize = fontSize * SCALE;

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) { resolve(FALLBACK_PNG); return; }

        ctx.clearRect(0, 0, w, h);
        
        // Basic system font stack for maximum compatibility
        const fontStr = (size: number) => `bold ${size}px "${fontFamily}", sans-serif`;
        ctx.font = fontStr(baseFontSize);
        
        // Measure text at desired font size
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        // Estimate height roughly as 1.2em
        const textHeight = baseFontSize * 1.2;

        // SCALE TO FIT LOGIC
        // We calculate how much we need to scale down to fit width and height
        const scaleX = w / textWidth;
        const scaleY = h / textHeight;
        // Use the smaller scale factor to ensure it fits both dimensions. 
        // We limit scale to 1 (don't scale UP if text is small, just center it).
        const fitScale = Math.min(scaleX, scaleY, 1);

        // Apply scale
        ctx.translate(w / 2, h / 2);
        ctx.scale(fitScale, fitScale);
        
        // Use middle alignment to center vertically in the box
        ctx.textBaseline = 'middle'; 
        ctx.textAlign = 'center';

        // Gradient Logic
        // Defined in LOCAL coordinate space after transform.
        // Text is centered at (0,0). Top is approx -textHeight/2, Bottom is +textHeight/2.
        // This ensures the gradient spans exactly the text height, making it vibrant even if text is small.
        if (isGradient) {
            const halfH = textHeight / 2;
            const gradient = ctx.createLinearGradient(0, -halfH, 0, halfH);
            gradient.addColorStop(0, colorOrGradientStart);
            gradient.addColorStop(1, gradientEnd);
            ctx.fillStyle = gradient;
        } else {
            ctx.fillStyle = colorOrGradientStart;
        }

        // Draw text at center (0,0 because we translated)
        ctx.fillText(text, 0, 0);

        canvas.toBlob((blob) => {
            if (blob) {
                blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
            } else {
                 resolve(FALLBACK_PNG);
            }
        }, 'image/png');
    });
};

// Process an uploaded image: Draw it to a canvas of the target dimensions (Aspect Fit / Contain)
// and export as standardized 32-bit PNG bytes.
export const processUploadedImage = async (
    file: File, 
    targetWidth: number, 
    targetHeight: number
): Promise<Uint8Array> => {
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

             // Calculate aspect ratio fit (Contain)
             const imgRatio = img.width / img.height;
             const targetRatio = w / h;
             
             let drawW, drawH, offsetX, offsetY;
             
             if (imgRatio > targetRatio) {
                 // Image is wider than target: constrain by width
                 drawW = w;
                 drawH = w / imgRatio;
                 offsetX = 0;
                 offsetY = (h - drawH) / 2;
             } else {
                 // Image is taller than target: constrain by height
                 drawH = h;
                 drawW = h * imgRatio;
                 offsetX = (w - drawW) / 2;
                 offsetY = 0;
             }

             // Draw image centered and contained
             ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

             canvas.toBlob((blob) => {
                 if (blob) {
                     blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
                 } else {
                     resolve(FALLBACK_PNG);
                 }
             }, 'image/png');
             
             URL.revokeObjectURL(img.src);
        };
        img.onerror = () => {
             resolve(FALLBACK_PNG);
        };
        img.src = URL.createObjectURL(file);
    });
};

export const addPlaceholderToSvga = async (
  svgaData: SvgaData,
  rect: Rect, // Static Rect for all frames
  keyName: string,
  customImageBytes?: Uint8Array, // Optional: Use custom image data (e.g. text bitmap) instead of transparent placeholder
  animation: AnimationPreset = 'none',
  animConfig: AnimationConfig = { cycles: 1, intensity: 1 }
): Promise<SvgaData> => {
  // Use custom bytes if provided, otherwise generate transparent PNG of exact size
  let pngBytes = customImageBytes;
  if (!pngBytes) {
      // Pass dimensions to match selection exactly
      pngBytes = await generatePlaceholderPng(rect.width, rect.height);
  }
  
  const safeKeyName = sanitizeKey(keyName);
  const newImages = svgaData.images ? { ...svgaData.images } : {};
  const totalFrames = svgaData.params?.frames || 0;
  const mainFrames = [];
  const spritesToAdd = [];
  const { cycles, intensity } = animConfig;

  // Note: Previous Frame Baking logic for shine animation has been removed
  // in favor of the Dual Layer approach below which is more efficient.

  const imageBase64 = uint8ArrayToBase64(pngBytes);
  newImages[safeKeyName] = imageBase64;
  
  // 1. Main Sprite
  for (let i = 0; i < totalFrames; i++) {
    if (rect.width <= 0 || rect.height <= 0) {
            mainFrames.push({ alpha: 0, layout: {}, transform: {} });
            continue;
    }
    // ... Animation Math ...
    let animScale = 1; let animY = 0;
    const progress = totalFrames > 0 ? i / totalFrames : 0; 
    const PI2 = Math.PI * 2;
    
    switch (animation) {
            case 'pulse': animScale = 1 + Math.sin(progress * PI2 * cycles) * (0.1 * intensity); break;
            case 'float': animY = Math.sin(progress * PI2 * cycles) * (6 * intensity); break;
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

  // 2. Shine Sprite
  if (animation === 'shine') {
      const shineBytes = await generateShineBitmap(rect.width, rect.height);
      newImages[`${safeKeyName}_shine`] = uint8ArrayToBase64(shineBytes);
      const shineFrames = [];
      
      for (let i = 0; i < totalFrames; i++) {
            let rawProgress = (totalFrames > 0 ? i / totalFrames : 0) * cycles;
            let progress = rawProgress % 1.0;
            const startTx = rect.x - rect.width;
            const endTx = rect.x + rect.width;
            const currentTx = startTx + (endTx - startTx) * progress;
            
            shineFrames.push({
                alpha: 1,
                layout: { x: 0, y: 0, width: rect.width, height: rect.height },
                transform: { a: 1, d: 1, tx: currentTx, ty: rect.y }
            });
      }
      spritesToAdd.push({
          imageKey: `${safeKeyName}_shine`,
          frames: shineFrames,
          matteKey: safeKeyName // Use Main Sprite as matte
      });
  }

  return {
    ...svgaData,
    images: newImages,
    sprites: [...(svgaData.sprites || []), ...spritesToAdd],
  };
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
        if (base64OrUrl.startsWith('data:')) {
            img.src = base64OrUrl;
        } else {
            img.src = 'data:image/png;base64,' + base64OrUrl;
        }
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