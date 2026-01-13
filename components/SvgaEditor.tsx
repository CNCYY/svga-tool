
import React, { useEffect, useRef, useState, useMemo } from "react";
import { ProcessedSvga, Rect, AnimationPreset, Language, EditorLayer, LayerType } from "../types";
import { addPlaceholderToSvga, encodeSvga, sanitizeImagesTo32Bit, generateTextBitmap, processUploadedImage, decodeSvga } from "../services/svgaService";
import { Download, Play, Pause, Layers, MousePointer2, FileCode, Clock, FileText, Type, SquareDashed, Grid3X3, Image as ImageIcon, Upload, Palette, Sparkles, Move, Trash2, Camera, X, RefreshCcw, Eraser } from "lucide-react";

interface SvgaEditorProps {
  processedSvga: ProcessedSvga;
  onReset: () => void;
  onUpload: (data: ProcessedSvga) => void;
  language: Language;
}

// Localization Dictionary
const I18N = {
    en: {
        layerType: "Layer Type",
        typeKey: "Dynamic Key",
        typeText: "Static Text",
        typeImage: "Static Image",
        layerName: "Layer Name / Key",
        recent: "Recent:",
        animation: "Animation Effects (Multi)",
        animNone: "None",
        animPulse: "Pulse",
        animFloat: "Float",
        animShine: "Shine",
        animFreq: "Speed / Freq",
        animIntense: "Intensity / Range",
        textContent: "Content",
        textSize: "Size (px)",
        fontFamily: "Font",
        fillStyle: "Fill Style",
        solid: "Solid",
        gradient: "Gradient",
        topColor: "Top Color",
        bottomColor: "Bottom Color",
        uploadImg: "Upload Image",
        clickUpload: "Click to browse",
        geometry: "Geometry",
        dragHint: "Drag on empty space to create layer",
        filename: "Output Filename",
        compress: "Compress Output",
        export: "Export SVGA",
        exportThumb: "Export Frame (PNG)",
        processing: "Processing...",
        openDiff: "Open Different File",
        clearCanvas: "Clear All Layers",
        frame: "Frame",
        placeholderText: "Enter text...",
        placeholderKey: "e.g. img_01",
        remarkEnglish: "(Input English Name)",
        noSelection: "No layer selected",
        selectHint: "Select a layer to edit properties",
        deleteLayer: "Delete Layer",
        thumbTitle: "Export Thumbnail",
        downloadPng: "Download PNG",
        close: "Close",
        dropToReplace: "Drop to replace current file",
        invalidFile: "Invalid file. Please drop an .svga file.",
        errorParams: "Failed to parse SVGA file."
    },
    zh: {
        layerType: "图层类型",
        typeKey: "动态 Key",
        typeText: "固定文字",
        typeImage: "固定图片",
        layerName: "图层名称 / Key",
        recent: "最近使用:",
        animation: "动画效果 (可多选)",
        animNone: "无动画",
        animPulse: "缩放 (Pulse)",
        animFloat: "浮动 (Float)",
        animShine: "扫光 (Shine)",
        animFreq: "速度 / 频率",
        animIntense: "强度 / 范围",
        textContent: "文本内容",
        textSize: "字号 (px)",
        fontFamily: "字体",
        fillStyle: "填充样式",
        solid: "纯色",
        gradient: "渐变",
        topColor: "顶部颜色",
        bottomColor: "底部颜色",
        uploadImg: "上传图片",
        clickUpload: "点击选择图片",
        geometry: "几何位置",
        dragHint: "在画布空白处拖拽以创建新图层",
        filename: "导出文件名",
        compress: "开启压缩",
        export: "导出 SVGA",
        exportThumb: "导出当前帧 (PNG)",
        processing: "处理中...",
        openDiff: "打开其他文件",
        clearCanvas: "清空所有图层",
        frame: "帧",
        placeholderText: "输入文本...",
        placeholderKey: "例如：avatar_01",
        remarkEnglish: "(请输入英文名)",
        noSelection: "未选择图层",
        selectHint: "点击图层以编辑属性",
        deleteLayer: "删除图层",
        thumbTitle: "导出缩略图",
        downloadPng: "下载 PNG",
        close: "关闭",
        dropToReplace: "松开以替换当前文件",
        invalidFile: "文件格式错误，请拖入 .svga 文件",
        errorParams: "解析 SVGA 文件失败"
    }
};

const FONT_OPTIONS = [
    { name: 'Sans Serif', value: 'sans-serif' },
    { name: 'Roboto', value: 'Roboto' },
    { name: 'Pacifico', value: 'Pacifico' },
    { name: 'Bangers', value: 'Bangers' },
    { name: 'Playfair Display', value: 'Playfair Display' },
    { name: 'Monospace', value: 'monospace' },
];

// --- Static Components ---
const SectionHeader = ({ icon: Icon, title, children }: { icon?: any, title: string, children?: React.ReactNode }) => (
    <h3 className="text-xs font-bold text-slate-200 mb-3 flex items-center gap-2 uppercase tracking-wide">
        {Icon && <Icon size={14} className="text-indigo-400" />} {title} {children}
    </h3>
);

const InputLabel = ({ children }: { children?: React.ReactNode }) => (
    <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">{children}</label>
);

const StyledInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input 
        {...props}
        className={`bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-600 ${props.className || ''}`}
    />
);

const SvgaEditor: React.FC<SvgaEditorProps> = ({ processedSvga, onReset, onUpload, language }) => {
  const t = I18N[language];
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [player, setPlayer] = useState<any>(null);
  const [videoItem, setVideoItem] = useState<any>(null); // Store parsed video item
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  
  // Layer Management
  const [layers, setLayers] = useState<EditorLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

  // Interaction State
  const [isDragging, setIsDragging] = useState(false);
  const [isFileDragging, setIsFileDragging] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [interactionMode, setInteractionMode] = useState<'create' | 'move'>('create');
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [creationRect, setCreationRect] = useState<Rect | null>(null);
  
  const activeLayer = useMemo(() => layers.find(l => l.id === activeLayerId) || null, [layers, activeLayerId]);

  // Global Settings
  const [isProcessing, setIsProcessing] = useState(false);
  const [compressOutput, setCompressOutput] = useState(true);
  const [recentKeys, setRecentKeys] = useState<string[]>([]);
  const [outputFilename, setOutputFilename] = useState("");
  const [svgaWidth, setSvgaWidth] = useState(processedSvga.data.params.viewBoxWidth);
  const [svgaHeight, setSvgaHeight] = useState(processedSvga.data.params.viewBoxHeight);
  const [scaleFactor, setScaleFactor] = useState(1);

  // Thumbnail Modal State
  const [showThumbModal, setShowThumbModal] = useState(false);
  const [thumbFrame, setThumbFrame] = useState(0);
  const thumbCanvasRef = useRef<HTMLCanvasElement>(null);
  const thumbPlayerRef = useRef<any>(null);

  // Animation Params for Preview
  const fps = processedSvga.data.params.fps || 20;
  const svgaDuration = totalFrames > 0 ? totalFrames / fps : 0;
  
  // Helper to update active layer
  const updateActiveLayer = (updates: Partial<EditorLayer>) => {
      if (!activeLayerId) return;
      setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, ...updates } : l));
  };

  const deleteActiveLayer = () => {
      if (!activeLayerId) return;
      setLayers(prev => prev.filter(l => l.id !== activeLayerId));
      setActiveLayerId(null);
  };

  const clearAllLayers = () => {
      if (confirm(language === 'zh' ? "确定要清空所有图层吗？" : "Are you sure you want to clear all layers?")) {
          setLayers([]);
          setActiveLayerId(null);
      }
  };

  // Toggle Animation in Array
  const toggleAnimation = (animId: AnimationPreset) => {
      if (!activeLayer) return;
      
      if (animId === 'none') {
          updateActiveLayer({ animations: [] });
          return;
      }

      let newAnimations = [...activeLayer.animations];
      if (newAnimations.includes(animId)) {
          newAnimations = newAnimations.filter(a => a !== animId);
      } else {
          newAnimations.push(animId);
      }
      
      // Ensure 'none' is removed if we add something else
      newAnimations = newAnimations.filter(a => a !== 'none');
      
      updateActiveLayer({ animations: newAnimations });
  };

  // Effects
  useEffect(() => {
      const saved = localStorage.getItem("svga_recent_keys");
      if (saved) {
          try { setRecentKeys(JSON.parse(saved)); } catch (e) {}
      }
      const base = processedSvga.filename.replace(/\.svga$/i, "");
      setOutputFilename(`${base}_patched`);
  }, [processedSvga.filename]);

  // Sync dimensions when prop changes
  useEffect(() => {
      if (processedSvga.data.params) {
          setSvgaWidth(processedSvga.data.params.viewBoxWidth);
          setSvgaHeight(processedSvga.data.params.viewBoxHeight);
      }
  }, [processedSvga]);

  // Generate text previews
  useEffect(() => {
    if (!activeLayer || activeLayer.type !== 'text') return;
    
    const { textContent, textSize, fontFamily, rect, isGradient, gradientStart, gradientEnd, textColor } = activeLayer;
    if (rect.width <= 0 || rect.height <= 0) return;

    let active = true;
    const gen = async () => {
        const bytes = await generateTextBitmap(
            textContent, textSize, fontFamily,
            rect.width, rect.height,
            isGradient ? gradientStart : textColor,
            isGradient, gradientEnd
        );
        if (!active) return;
        const blob = new Blob([bytes], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        updateActiveLayer({ cachedPreviewUrl: url });
    };
    gen();
    return () => { active = false; };
  }, [
      activeLayer?.textContent, activeLayer?.textSize, activeLayer?.textColor, 
      activeLayer?.fontFamily, activeLayer?.isGradient, activeLayer?.gradientStart, 
      activeLayer?.gradientEnd, activeLayer?.rect.width, activeLayer?.rect.height
  ]);

  // Init Main Player Instance (Once)
  useEffect(() => {
    if (!canvasRef.current) return;
    const { SVGA } = window;
    if (!SVGA) return;

    const newPlayer = new SVGA.Player(canvasRef.current);
    newPlayer.loops = 0;
    newPlayer.clearsAfterStop = false;
    newPlayer.setContentMode("Fill");
    newPlayer.onFrame((frame: number) => setCurrentFrame(frame));
    
    setPlayer(newPlayer);

    return () => {
        newPlayer.stopAnimation();
        newPlayer.clear();
    };
  }, []);

  // Load Content into Player (When file changes)
  useEffect(() => {
      if (!player || !processedSvga.url) return;
      const { SVGA } = window;
      if (!SVGA) return;

      // Stop previous animation to prevent fighting
      player.stopAnimation();
      player.clear();
      setIsPlaying(true);

      const parser = new SVGA.Parser();
      parser.load(processedSvga.url, (loadedItem: any) => {
          // Double check to ensure dimension consistency
          if (loadedItem.videoSize) {
              if (loadedItem.videoSize.width !== svgaWidth || loadedItem.videoSize.height !== svgaHeight) {
                setSvgaWidth(loadedItem.videoSize.width);
                setSvgaHeight(loadedItem.videoSize.height);
              }
          }
          setTotalFrames(loadedItem.frames);
          setVideoItem(loadedItem); // Cache video item for thumbnail modal
          player.setVideoItem(loadedItem);
          player.startAnimation();
      });
  }, [player, processedSvga.url]);

  // Thumbnail Modal Player Logic
  useEffect(() => {
      if (showThumbModal && thumbCanvasRef.current && videoItem) {
          if (!thumbPlayerRef.current) {
              const p = new window.SVGA.Player(thumbCanvasRef.current);
              p.loops = 0;
              p.clearsAfterStop = false;
              p.setContentMode("Fill");
              p.setVideoItem(videoItem);
              thumbPlayerRef.current = p;
          }
          // Seek to specific frame and PAUSE (false) to allow precise static selection
          thumbPlayerRef.current.stepToFrame(thumbFrame, false);
      }
  }, [showThumbModal, thumbFrame, videoItem]);

  // Reset thumbnail player on close
  useEffect(() => {
      if (!showThumbModal && thumbPlayerRef.current) {
          thumbPlayerRef.current = null; // Let GC handle it, or clear()
      }
  }, [showThumbModal]);

  // Resize Handler
  useEffect(() => {
    const handleResize = () => {
      if (overlayRef.current) {
        const { width } = overlayRef.current.getBoundingClientRect();
        setScaleFactor(width / svgaWidth); 
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize(); 
    const interval = setInterval(handleResize, 500);
    return () => { window.removeEventListener("resize", handleResize); clearInterval(interval); }
  }, [svgaWidth, svgaHeight]);

  const togglePlay = () => {
    if (!player) return;
    isPlaying ? player.pauseAnimation() : player.startAnimation();
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const frame = parseInt(e.target.value);
      if (player) {
          player.pauseAnimation();
          player.stepToFrame(frame, true);
          setIsPlaying(false);
          setCurrentFrame(frame);
      }
  };

  // Interaction Logic
  const getSvgaCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!overlayRef.current) return { x: 0, y: 0 };
    const rect = overlayRef.current.getBoundingClientRect();
    const currentScaleX = rect.width / svgaWidth;
    const currentScaleY = rect.height / svgaHeight;
    let clientX, clientY;
    if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; } 
    else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }
    return { x: (clientX - rect.left) / currentScaleX, y: (clientY - rect.top) / currentScaleY };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (isPlaying && player) { player.pauseAnimation(); setIsPlaying(false); }
    const coords = getSvgaCoordinates(e);

    // Hit test layers (Reverse order)
    let hitLayerId: string | null = null;
    for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];
        const { x, y, width, height } = layer.rect;
        if (coords.x >= x && coords.x <= x + width && coords.y >= y && coords.y <= y + height) {
            hitLayerId = layer.id;
            break;
        }
    }

    if (hitLayerId) {
        setActiveLayerId(hitLayerId);
        setInteractionMode('move');
        const layer = layers.find(l => l.id === hitLayerId)!;
        setDragOffset({ x: coords.x - layer.rect.x, y: coords.y - layer.rect.y });
    } else {
        setInteractionMode('create');
        setStartPoint(coords);
        setActiveLayerId(null);
        // Initialize temp creation rect
        setCreationRect({ x: coords.x, y: coords.y, width: 0, height: 0 });
    }
    
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const coords = getSvgaCoordinates(e);

    if (interactionMode === 'move' && activeLayerId) {
        const newX = coords.x - dragOffset.x;
        const newY = coords.y - dragOffset.y;
        setLayers(prev => prev.map(l => {
            if (l.id === activeLayerId) {
                return { ...l, rect: { ...l.rect, x: newX, y: newY } };
            }
            return l;
        }));
    } else if (interactionMode === 'create' && startPoint) {
        // Update temp rect visual
        const x = Math.min(coords.x, startPoint.x);
        const y = Math.min(coords.y, startPoint.y);
        const width = Math.abs(coords.x - startPoint.x);
        const height = Math.abs(coords.y - startPoint.y);
        setCreationRect({ x, y, width, height });
    }
  };

  const handlePointerUp = (e: React.MouseEvent | React.TouchEvent) => {
      if (interactionMode === 'create' && isDragging && startPoint) {
           const coords = getSvgaCoordinates(e);
           const x = Math.min(coords.x, startPoint.x);
           const y = Math.min(coords.y, startPoint.y);
           const width = Math.abs(coords.x - startPoint.x);
           const height = Math.abs(coords.y - startPoint.y);
           
           if (width > 5 && height > 5) {
               const newId = Date.now().toString();
               const newLayer: EditorLayer = {
                   id: newId,
                   type: 'key',
                   name: `layer_${layers.length + 1}`,
                   rect: { x, y, width, height },
                   animations: [], // Initial empty animations
                   animConfig: { cycles: 1, intensity: 1 },
                   textContent: language === 'zh' ? "输入文字" : "Your Text",
                   textSize: 24,
                   textColor: "#ffffff",
                   fontFamily: "sans-serif",
                   isGradient: false,
                   gradientStart: "#FFD700",
                   gradientEnd: "#FFA500",
                   imageFile: null,
                   imagePreviewUrl: null,
                   cachedPreviewUrl: null
               };
               setLayers(prev => [...prev, newLayer]);
               setActiveLayerId(newId);
           }
      }
      setIsDragging(false);
      setStartPoint(null);
      setCreationRect(null); // Clear temp rect
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          updateActiveLayer({ 
              imageFile: file, 
              imagePreviewUrl: URL.createObjectURL(file) 
          });
      }
  };

  const openThumbnailModal = () => {
      if (player) player.pauseAnimation();
      setIsPlaying(false);
      setThumbFrame(currentFrame);
      setShowThumbModal(true);
  };

  const handleDownloadThumbnail = async () => {
    if (!thumbCanvasRef.current) return;
    setIsProcessing(true);

    try {
        // 1. Setup Temp Canvas for Compositing (same size as SVGA)
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = svgaWidth;
        exportCanvas.height = svgaHeight;
        const ctx = exportCanvas.getContext('2d');
        if (!ctx) throw new Error("Canvas context failed");

        // 2. Draw SVGA Frame from Thumb Canvas
        ctx.drawImage(thumbCanvasRef.current, 0, 0, svgaWidth, svgaHeight);

        // 3. Draw Layers
        for (const layer of layers) {
            let imgUrl = layer.type === 'text' ? layer.cachedPreviewUrl : layer.imagePreviewUrl;
            
            if (imgUrl) {
                await new Promise<void>((resolve) => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => {
                        const imgRatio = img.width / img.height;
                        const rectRatio = layer.rect.width / layer.rect.height;
                        
                        let drawW = layer.rect.width;
                        let drawH = layer.rect.height;
                        let offsetX = 0;
                        let offsetY = 0;

                        if (imgRatio > rectRatio) {
                             // Image is wider than container, fit width
                             drawH = drawW / imgRatio;
                             offsetY = (layer.rect.height - drawH) / 2;
                        } else {
                             // Image is taller than container, fit height
                             drawW = drawH * imgRatio;
                             offsetX = (layer.rect.width - drawW) / 2;
                        }

                        ctx.drawImage(img, layer.rect.x + offsetX, layer.rect.y + offsetY, drawW, drawH);
                        resolve();
                    };
                    img.onerror = () => resolve(); 
                    img.src = imgUrl;
                });
            } else if (layer.type === 'key') {
                // Draw a simple dashed placeholder for empty keys
                ctx.save();
                ctx.strokeStyle = "rgba(255,255,255,0.4)";
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 6]);
                ctx.strokeRect(layer.rect.x, layer.rect.y, layer.rect.width, layer.rect.height);
                ctx.restore();
            }
        }

        // 4. Download
        const dataUrl = exportCanvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = dataUrl;
        const safeFilename = outputFilename.replace(/[^a-zA-Z0-9_\-]/g, "_") || "output";
        a.download = `${safeFilename}_frame_${thumbFrame}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

    } catch (e) {
        console.error(e);
        alert("Thumbnail export failed");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleExport = async () => {
    if (layers.length === 0) return;
    setIsProcessing(true);
    try {
      let currentData = { ...processedSvga.data, params: { ...processedSvga.data.params, viewBoxWidth: svgaWidth, viewBoxHeight: svgaHeight } };
      
      for (const layer of layers) {
          let customImageBytes: Uint8Array | undefined = undefined;

          if (layer.type === 'text') {
               customImageBytes = await generateTextBitmap(
                  layer.textContent, layer.textSize, layer.fontFamily, 
                  layer.rect.width, layer.rect.height,
                  layer.isGradient ? layer.gradientStart : layer.textColor,
                  layer.isGradient, layer.gradientEnd
               );
          } else if (layer.type === 'image') {
              if (layer.imageFile) {
                  customImageBytes = await processUploadedImage(layer.imageFile, layer.rect.width, layer.rect.height);
              }
          }
          
          currentData = await addPlaceholderToSvga(
              currentData, 
              layer.rect, 
              layer.name, 
              customImageBytes, 
              layer.animations, // Pass array
              layer.animConfig
          );
      }
      
      if (currentData.images) currentData.images = await sanitizeImagesTo32Bit(currentData.images);
      const bytes = encodeSvga(currentData, compressOutput);
      const blob = new Blob([bytes], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeFilename = outputFilename.replace(/[^a-zA-Z0-9_\-]/g, "_") || "output";
      const suffix = compressOutput ? "" : "_raw";
      a.download = `${safeFilename}${suffix}.svga`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      const keysUsed = layers.map(l => l.name);
      const newHistory = [...new Set([...keysUsed, ...recentKeys])].slice(0, 10);
      setRecentKeys(newHistory);
      localStorage.setItem("svga_recent_keys", JSON.stringify(newHistory));

    } catch (err: any) { alert(err.message); } 
    finally { setIsProcessing(false); }
  };

  // Drag and Drop File Replacement Handlers
  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      // Only trigger if dragging a file
      if (e.dataTransfer.types.includes("Files")) {
          setIsFileDragging(true);
      }
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      // Simple check to see if we left the window or the main container
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      setIsFileDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      setIsFileDragging(false);
      
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          const file = e.dataTransfer.files[0];
          if (!file.name.toLowerCase().endsWith(".svga")) {
              alert(t.invalidFile);
              return;
          }
          
          // Reusing logic from SvgaUploader implicitly by duplicating for now (or could import if logic was shared in utils)
          setIsProcessing(true);
          try {
              const buffer = await file.arrayBuffer();
              const svgaData = await decodeSvga(buffer);
              
              const processed: ProcessedSvga = {
                  buffer,
                  data: svgaData,
                  url: URL.createObjectURL(file),
                  filename: file.name,
              };
              
              onUpload(processed); // Switch to new file
          } catch (err: any) {
              console.error(err);
              alert(t.errorParams || "Failed to parse SVGA");
          } finally {
              setIsProcessing(false);
          }
      }
  };

  // Generate dynamic keyframes based on layer settings
  const layerKeyframesStyles = useMemo(() => {
    return layers.map(layer => {
        if (!layer.animations || layer.animations.length === 0) return '';
        const { id, animConfig, animations } = layer;
        const { intensity } = animConfig;
        
        let keyframeContent = "";
        
        // 1. Combined Transform Keyframes (Pulse + Float)
        if (animations.includes('pulse') || animations.includes('float')) {
            const steps = 40;
            let transformFrames = "";
            for (let i = 0; i <= steps; i++) {
                const percent = (i / steps) * 100;
                const progress = i / steps;
                const angle = progress * Math.PI * 2;
                
                let scale = 1;
                let translateY = 0;

                if (animations.includes('pulse')) {
                    scale = 1 + Math.sin(angle) * (0.05 * intensity);
                }
                if (animations.includes('float')) {
                    translateY = Math.sin(angle) * (6 * intensity);
                }

                transformFrames += `${percent}% { transform: scale(${scale.toFixed(4)}) translateY(${translateY.toFixed(2)}px); }\n`;
            }
            keyframeContent += `@keyframes anim-combined-${id} { ${transformFrames} } \n`;
        }

        // 2. Shine Keyframes (Mask Position)
        if (animations.includes('shine')) {
            keyframeContent += `
                @keyframes anim-shine-mask-${id} {
                    0% { -webkit-mask-position: -150% 0; mask-position: -150% 0; }
                    100% { -webkit-mask-position: 250% 0; mask-position: 250% 0; }
                }
            `;
        }

        return keyframeContent;
    }).join('\n');
  }, [layers]);

  return (
    <div 
        className="flex flex-col lg:flex-row h-[100dvh] bg-[#0A0F1C] overflow-hidden text-slate-200 font-sans relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
      {/* File Drop Overlay */}
      {isFileDragging && (
          <div className="absolute inset-0 z-[100] bg-indigo-900/80 backdrop-blur-sm flex items-center justify-center border-4 border-indigo-400 border-dashed m-4 rounded-3xl animate-in fade-in duration-200 pointer-events-none">
              <div className="text-center text-white">
                  <RefreshCcw size={64} className="mx-auto mb-4 animate-spin-slow" />
                  <h2 className="text-3xl font-bold">{t.dropToReplace}</h2>
              </div>
          </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bangers&family=Pacifico&family=Playfair+Display:wght@700&family=Roboto:wght@700&display=swap');
        ${layerKeyframesStyles}
      `}</style>
      
      {/* --- THUMBNAIL EXPORT MODAL --- */}
      {showThumbModal && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
              <div className="bg-[#1a202c] border border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-4xl flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center border-b border-white/5 pb-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          <Camera size={20} className="text-indigo-400" />
                          {t.thumbTitle}
                      </h3>
                      <button 
                          onClick={() => setShowThumbModal(false)}
                          className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
                      >
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="flex-1 min-h-0 bg-[#0F1623] rounded-xl border border-white/5 relative overflow-hidden flex items-center justify-center p-4">
                      <div className="relative shadow-xl" style={{ 
                          width: svgaWidth * Math.min(1, 600/svgaWidth), 
                          height: svgaHeight * Math.min(1, 600/svgaWidth),
                          aspectRatio: `${svgaWidth}/${svgaHeight}`
                      }}>
                          {/* SVGA Canvas for Thumbnail */}
                          <canvas 
                              ref={thumbCanvasRef} 
                              width={svgaWidth} 
                              height={svgaHeight} 
                              className="w-full h-full block"
                          />
                          
                          {/* Layers Overlay (Static) */}
                          <div className="absolute inset-0 pointer-events-none">
                            {layers.map(layer => {
                                const maskUrl = layer.type === 'text' ? layer.cachedPreviewUrl : layer.imagePreviewUrl;
                                // Scale positions based on current display size in modal vs actual svga size
                                // We use percentage for easier scaling
                                const left = (layer.rect.x / svgaWidth) * 100;
                                const top = (layer.rect.y / svgaHeight) * 100;
                                const width = (layer.rect.width / svgaWidth) * 100;
                                const height = (layer.rect.height / svgaHeight) * 100;

                                return (
                                    <div 
                                        key={layer.id}
                                        className="absolute"
                                        style={{
                                            left: `${left}%`,
                                            top: `${top}%`,
                                            width: `${width}%`,
                                            height: `${height}%`,
                                        }}
                                    >
                                        {layer.type === 'text' && layer.cachedPreviewUrl && <img src={layer.cachedPreviewUrl} alt="" className="w-full h-full object-contain" />}
                                        {layer.type === 'image' && layer.imagePreviewUrl && <img src={layer.imagePreviewUrl} alt="" className="w-full h-full object-contain" />}
                                        {layer.type === 'key' && !layer.cachedPreviewUrl && (
                                            <div className="w-full h-full border border-white/40 border-dashed bg-white/5"></div>
                                        )}
                                    </div>
                                );
                            })}
                          </div>
                      </div>
                  </div>

                  <div className="space-y-4">
                       <div className="flex justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
                           <span>Frame: {thumbFrame}</span>
                           <span>Max: {totalFrames - 1}</span>
                       </div>
                       <input 
                           type="range" 
                           min="0" 
                           max={totalFrames - 1} 
                           value={thumbFrame} 
                           onChange={(e) => setThumbFrame(parseInt(e.target.value))}
                           className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                       />
                  </div>

                  <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
                      <button 
                          onClick={() => setShowThumbModal(false)}
                          className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors"
                      >
                          {t.close}
                      </button>
                      <button 
                          onClick={handleDownloadThumbnail}
                          disabled={isProcessing}
                          className="px-6 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2"
                      >
                          {isProcessing ? <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span> : <Download size={16} />}
                          {t.downloadPng}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- LEFT SIDEBAR (Editor) --- */}
      <div className="w-full lg:w-[340px] bg-[#0F1623]/80 border-b lg:border-b-0 lg:border-r border-white/5 p-6 flex flex-col gap-6 shadow-2xl z-20 shrink-0 overflow-y-auto max-h-[40vh] lg:max-h-full backdrop-blur-xl order-2 lg:order-1 scrollbar-hide">
        {/* ... (Existing Left Sidebar Code is unchanged, just wrapping in <> implicitly) ... */}
        {activeLayer ? (
            <>
                <div className="flex justify-between items-center p-4 mb-4 bg-white/5 rounded-xl border border-white/5">
                     <span className="text-indigo-300 text-sm font-mono font-bold flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                         ID: {activeLayer.name}
                     </span>
                     <button onClick={deleteActiveLayer} className="text-red-400 hover:text-red-200 p-2 hover:bg-red-500/10 rounded-lg transition-colors" title={t.deleteLayer}>
                         <Trash2 size={16} />
                     </button>
                </div>

                <div className="space-y-3">
                    <InputLabel>{t.layerType}</InputLabel>
                    <div className="flex bg-black/40 p-1.5 rounded-xl border border-white/5 shadow-inner">
                        {[
                            { id: 'key', icon: Grid3X3, label: t.typeKey },
                            { id: 'text', icon: Type, label: t.typeText },
                            { id: 'image', icon: ImageIcon, label: t.typeImage }
                        ].map((type) => (
                            <button 
                                key={type.id}
                                onClick={() => updateActiveLayer({ type: type.id as LayerType })}
                                className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg text-[10px] lg:text-xs font-medium transition-all duration-300 ${activeLayer.type === type.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50 scale-[1.02]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                            >
                                <type.icon size={16} className={activeLayer.type === type.id ? "text-indigo-100" : ""} /> {type.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <InputLabel>{t.layerName}</InputLabel>
                    <StyledInput 
                        type="text" 
                        value={activeLayer.name}
                        onChange={(e) => updateActiveLayer({ name: e.target.value.replace(/\s/g, "_") })}
                        placeholder={t.placeholderKey}
                        className="w-full font-mono text-indigo-300"
                    />
                    {activeLayer.type === 'key' && recentKeys.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            <span className="text-[10px] text-slate-400 w-full flex items-center gap-1.5 mb-1"><Clock size={10}/> {t.recent}</span>
                            {recentKeys.map(key => (
                                <button key={key} onClick={() => updateActiveLayer({ name: key })} className="text-[10px] bg-white/5 hover:bg-white/10 hover:text-white text-slate-400 px-2.5 py-1 rounded-md border border-white/5 transition-all">
                                    {key}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-white/[0.02] p-5 rounded-2xl border border-white/5 space-y-4 shadow-sm">
                    <SectionHeader icon={Sparkles} title={t.animation}>
                            <span className="text-yellow-400/80 drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]">✨</span>
                    </SectionHeader>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { id: 'none', label: t.animNone },
                            { id: 'pulse', label: t.animPulse },
                            { id: 'float', label: t.animFloat },
                            { id: 'shine', label: t.animShine }
                        ].map(anim => {
                            const isSelected = anim.id === 'none' 
                                ? activeLayer.animations.length === 0 
                                : activeLayer.animations.includes(anim.id as AnimationPreset);
                            
                            return (
                                <button 
                                    key={anim.id}
                                    onClick={() => toggleAnimation(anim.id as AnimationPreset)}
                                    className={`text-xs py-2.5 px-2 rounded-lg border transition-all duration-200 font-medium ${isSelected ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200' : 'bg-black/20 border-transparent text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
                                >
                                    {anim.label}
                                </button>
                            );
                        })}
                    </div>
                    {activeLayer.animations.length > 0 && (
                        <div className="space-y-4 pt-4 border-t border-white/5 mt-2">
                            {[
                                { label: t.animFreq, val: activeLayer.animConfig.cycles, key: 'cycles', min: 0.5, max: 3 },
                                { label: t.animIntense, val: activeLayer.animConfig.intensity, key: 'intensity', min: 0.5, max: 2 }
                            ].map(ctrl => (
                                <div key={ctrl.label}>
                                    <div className="flex justify-between mb-2">
                                        <InputLabel>{ctrl.label}</InputLabel>
                                        <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-1.5 rounded">{ctrl.val}</span>
                                    </div>
                                    <input 
                                        type="range" min={ctrl.min} max={ctrl.max} step="0.1" 
                                        value={ctrl.val} onChange={(e) => updateActiveLayer({ animConfig: { ...activeLayer.animConfig, [ctrl.key]: parseFloat(e.target.value) } })}
                                        className="w-full h-1.5 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {activeLayer.type === 'text' && (
                    <div className="bg-white/[0.02] p-5 rounded-2xl border border-white/5 space-y-5 shadow-sm">
                         <div className="space-y-2">
                            <InputLabel>{t.textContent}</InputLabel>
                            <StyledInput 
                                type="text" value={activeLayer.textContent} onChange={(e) => updateActiveLayer({ textContent: e.target.value })}
                                placeholder={t.placeholderText} className="w-full"
                            />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <InputLabel>{t.textSize}</InputLabel>
                                <StyledInput type="number" value={activeLayer.textSize} onChange={(e) => updateActiveLayer({ textSize: parseInt(e.target.value) })} className="w-full" />
                             </div>
                             <div className="space-y-2">
                                <InputLabel>{t.fontFamily}</InputLabel>
                                <select value={activeLayer.fontFamily} onChange={(e) => updateActiveLayer({ fontFamily: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-xs text-white outline-none focus:border-indigo-500/80 h-[34px]">
                                    {FONT_OPTIONS.map(font => <option key={font.value} value={font.value}>{font.name}</option>)}
                                </select>
                             </div>
                         </div>
                         <div className="pt-4 border-t border-white/5 space-y-4">
                            <div className="flex justify-between items-center">
                                <InputLabel><span className="flex items-center gap-1.5"><Palette size={12} className="text-pink-400" /> {t.fillStyle}</span></InputLabel>
                                <button onClick={() => updateActiveLayer({ isGradient: !activeLayer.isGradient })} className="text-[10px] bg-white/5 hover:bg-white/10 px-3 py-1 rounded text-slate-300 transition-colors border border-white/5">
                                    {activeLayer.isGradient ? t.gradient : t.solid}
                                </button>
                            </div>
                            {!activeLayer.isGradient ? (
                                <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-lg p-3">
                                     <input type="color" value={activeLayer.textColor} onChange={(e) => updateActiveLayer({ textColor: e.target.value })} className="h-6 w-10 bg-transparent border-0 cursor-pointer rounded overflow-hidden" />
                                     <span className="text-xs font-mono text-slate-300 uppercase">{activeLayer.textColor}</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    {[ { l: t.topColor, v: activeLayer.gradientStart, k: 'gradientStart' }, { l: t.bottomColor, v: activeLayer.gradientEnd, k: 'gradientEnd' } ].map(c => (
                                        <div key={c.l} className="bg-black/40 border border-white/10 rounded-lg p-3 flex flex-col gap-2">
                                            <span className="text-[9px] text-slate-500 uppercase font-bold">{c.l}</span>
                                            <div className="flex items-center gap-2">
                                                <input type="color" value={c.v} onChange={(e) => updateActiveLayer({ [c.k]: e.target.value })} className="h-6 w-full bg-transparent border-0 cursor-pointer rounded" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                         </div>
                    </div>
                )}

                {activeLayer.type === 'image' && (
                     <div className="bg-white/[0.02] p-5 rounded-2xl border border-white/5 space-y-4 shadow-sm">
                        <SectionHeader icon={ImageIcon} title={t.uploadImg} />
                        <div onClick={() => fileInputRef.current?.click()} className="group border border-dashed border-white/10 bg-black/20 hover:bg-black/40 hover:border-indigo-500/50 rounded-xl p-6 cursor-pointer flex flex-col items-center text-center transition-all duration-300">
                            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleImageUpload} />
                            {activeLayer.imagePreviewUrl ? (
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-20 h-20 rounded-lg border border-white/10 overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] shadow-md">
                                        <img src={activeLayer.imagePreviewUrl} alt="Preview" className="w-full h-full object-contain" />
                                    </div>
                                    <span className="text-[10px] text-slate-400 truncate w-40 bg-black/40 px-2 py-1 rounded">{activeLayer.imageFile?.name}</span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-3 text-slate-500 group-hover:text-indigo-400 transition-colors">
                                    <Upload size={24} className="opacity-70 group-hover:scale-110 transition-transform" />
                                    <span className="text-xs font-medium">{t.clickUpload}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="bg-white/[0.02] p-5 rounded-2xl border border-white/5 shadow-sm space-y-6">
                    <SectionHeader icon={SquareDashed} title={t.geometry} />
                    <div className="space-y-5">
                        {[
                            { key: 'x', label: 'X (Left)', max: svgaWidth },
                            { key: 'y', label: 'Y (Top)', max: svgaHeight },
                            { key: 'width', label: 'W (Width)', max: svgaWidth },
                            { key: 'height', label: 'H (Height)', max: svgaHeight }
                        ].map((prop) => (
                            <div key={prop.key} className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <InputLabel>{prop.label}</InputLabel>
                                    <input 
                                        type="number" 
                                        value={Math.round((activeLayer.rect as any)[prop.key])} 
                                        onChange={(e) => updateActiveLayer({ rect: { ...activeLayer.rect, [prop.key]: parseFloat(e.target.value) || 0 } })} 
                                        className="bg-indigo-500/10 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-indigo-300 font-mono text-center outline-none focus:border-indigo-500/50 w-16"
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="range" 
                                        min={prop.key.startsWith('w') || prop.key.startsWith('h') ? 1 : -prop.max} 
                                        max={prop.max * 1.5} 
                                        step="1" 
                                        value={(activeLayer.rect as any)[prop.key]} 
                                        onChange={(e) => updateActiveLayer({ rect: { ...activeLayer.rect, [prop.key]: parseFloat(e.target.value) } })}
                                        className="flex-1 h-1.5 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center p-8 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6 ring-1 ring-white/10">
                    <MousePointer2 size={28} className="text-indigo-400 opacity-80" />
                </div>
                <p className="text-sm font-medium text-slate-200">{t.noSelection}</p>
                <p className="text-xs text-slate-500 mt-2 max-w-[200px] leading-relaxed">{t.dragHint}</p>
            </div>
        )}
      </div>

      {/* --- MAIN CANVAS AREA --- */}
      <div className="flex-1 flex flex-col h-full min-h-0 relative bg-[#0B0F17] order-1 lg:order-2">
        {/* Toolbar */}
        <div className="h-16 bg-[#0F1623]/90 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-10 gap-6 shadow-md">
            <div className="flex items-center gap-5 flex-1">
                 <button onClick={togglePlay} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white transition-all hover:scale-105 active:scale-95 border border-white/5 shadow-sm">
                     {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                 </button>
                 <div className="flex-1 flex flex-col gap-2 max-w-md">
                     <div className="flex justify-between text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                         <span>{t.frame} {currentFrame}</span>
                         <span>{totalFrames}</span>
                     </div>
                     <div className="relative h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full transition-all duration-75 shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: `${(currentFrame / (totalFrames - 1 || 1)) * 100}%` }}></div>
                        <input 
                            type="range" min="0" max={totalFrames - 1} value={currentFrame} onChange={handleSeek}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                     </div>
                 </div>
            </div>
        </div>

        {/* Canvas Wrapper */}
        <div className="flex-1 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] overflow-auto flex items-center justify-center p-8 touch-none">
            <div 
                ref={containerRef}
                className="relative shadow-2xl shadow-black ring-1 ring-slate-700/50 bg-[#161b22] shrink-0 transition-shadow duration-500 hover:shadow-indigo-900/10 rounded-sm"
                style={{ 
                    width: svgaWidth * scaleFactor, 
                    height: svgaHeight * scaleFactor,
                    maxWidth: '100%',
                    maxHeight: '100%',
                    aspectRatio: `${svgaWidth}/${svgaHeight}`
                }}
            >
                <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full block" width={svgaWidth} height={svgaHeight} style={{ width: '100%', height: '100%' }} />

                <div 
                    ref={overlayRef}
                    className="absolute inset-0 cursor-crosshair z-10 touch-none overflow-hidden"
                    onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp} onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp}
                >
                    {/* Render All Layers */}
                    {layers.map(layer => {
                        const isActive = layer.id === activeLayerId;
                        const animDuration = svgaDuration && svgaDuration > 0 ? svgaDuration / layer.animConfig.cycles : 1;
                        // const animName = layer.animation === 'pulse' ? `anim-pulse-${layer.id}` : layer.animation === 'float' ? `anim-float-${layer.id}` : 'none';
                        const maskUrl = layer.type === 'text' ? layer.cachedPreviewUrl : layer.imagePreviewUrl;
                        const hasAnim = layer.animations && layer.animations.length > 0;
                        const isShine = layer.animations.includes('shine');

                        return (
                            <div 
                                key={layer.id}
                                className={`absolute flex items-center justify-center pointer-events-auto cursor-move group`}
                                style={{
                                    left: layer.rect.x * scaleFactor,
                                    top: layer.rect.y * scaleFactor,
                                    width: layer.rect.width * scaleFactor,
                                    height: layer.rect.height * scaleFactor,
                                    zIndex: isActive ? 20 : 10
                                }}
                            >
                                {/* Selection Border */}
                                <div className={`absolute inset-0 ring-1 z-10 pointer-events-none transition-all duration-200 ${isActive ? 'ring-indigo-400 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.3)]' : 'ring-white/30 bg-white/5 hover:bg-white/10 hover:ring-white/50'}`}></div>
                                
                                {/* Center Move Handle */}
                                {isActive && (
                                    <div className="absolute inset-0 flex items-center justify-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                                        <div className="bg-indigo-600/60 backdrop-blur-md p-2 rounded-full border border-white/30 shadow-lg scale-90 group-hover:scale-100 transition-transform">
                                            <Move size={20} className="text-white drop-shadow-md" />
                                        </div>
                                    </div>
                                )}
                                
                                {/* Main Content (Text/Image) with Combined Transform Animation */}
                                <div className="w-full h-full relative pointer-events-none" style={{ 
                                    animation: hasAnim ? `anim-combined-${layer.id} ${animDuration}s linear infinite` : 'none'
                                }}>
                                    {layer.type === 'text' && layer.cachedPreviewUrl && <img src={layer.cachedPreviewUrl} alt="Preview" className="w-full h-full object-contain pointer-events-none opacity-90 drop-shadow-lg" />}
                                    {layer.type === 'image' && layer.imagePreviewUrl && <img src={layer.imagePreviewUrl} alt="Preview" className="w-full h-full object-contain pointer-events-none opacity-90 drop-shadow-lg" />}
                                    {/* Placeholder for Key */}
                                    {layer.type === 'key' && !layer.cachedPreviewUrl && (
                                        <div className="w-full h-full border border-white/20 bg-white/5 flex items-center justify-center">
                                            <Grid3X3 size={12} className="text-slate-500"/>
                                        </div>
                                    )}
                                </div>

                                {/* Shine Effect (Mask Image Animation for Soft Edge) - Rendered separately as overlay */}
                                {isShine && (
                                    <div 
                                        className="absolute inset-0 pointer-events-none"
                                        style={{
                                            animation: `anim-shine-mask-${layer.id} ${animDuration}s linear infinite`,
                                            // Linear Gradient Mask for Soft Sweep (Left to Right)
                                            WebkitMaskImage: `linear-gradient(110deg, transparent 25%, black 45%, black 55%, transparent 75%)`,
                                            maskImage: `linear-gradient(110deg, transparent 25%, black 45%, black 55%, transparent 75%)`,
                                            WebkitMaskSize: '250% 100%',
                                            maskSize: '250% 100%',
                                            WebkitMaskRepeat: 'no-repeat',
                                            maskRepeat: 'no-repeat',
                                        }}
                                    >
                                        {maskUrl ? (
                                            /* Render the content again but with Gold/White Glow Overlay */
                                            <div 
                                                className="w-full h-full"
                                                style={{
                                                    background: 'linear-gradient(135deg, #FFFFFF 0%, #FFE082 30%, #FFFFFF 50%, #FFE082 70%, #FFFFFF 100%)',
                                                    maskImage: `url(${maskUrl})`,
                                                    WebkitMaskImage: `url(${maskUrl})`,
                                                    maskSize: 'contain',
                                                    WebkitMaskSize: 'contain',
                                                    maskRepeat: 'no-repeat',
                                                    maskPosition: 'center',
                                                    WebkitMaskPosition: 'center',
                                                    // Add blur to make it feathered and glowing
                                                    filter: 'blur(2px) brightness(1.2)'
                                                }}
                                            />
                                        ) : (
                                            /* Solid Pale Gold Block for Key */
                                            <div className="w-full h-full bg-gradient-to-br from-white via-yellow-200 to-white opacity-90 filter blur-sm" />
                                        )}
                                    </div>
                                )}

                                {isActive && (
                                    <span className="bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 absolute -top-5 left-0 whitespace-nowrap rounded shadow-sm opacity-90 z-20 uppercase tracking-wide pointer-events-none">
                                        {layer.type === 'text' ? 'TEXT' : layer.type === 'image' ? 'IMG' : 'KEY'} • {layer.name}
                                    </span>
                                )}
                            </div>
                        );
                    })}

                    {/* Real-time Creation Preview Rect */}
                    {interactionMode === 'create' && isDragging && creationRect && (
                         <div 
                            className="absolute border border-dashed border-white/70 bg-indigo-500/20 z-30 pointer-events-none transition-all duration-75 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                            style={{
                                left: creationRect.x * scaleFactor,
                                top: creationRect.y * scaleFactor,
                                width: creationRect.width * scaleFactor,
                                height: creationRect.height * scaleFactor,
                            }}
                         >
                            <span className="absolute -top-5 left-0 text-[9px] font-mono bg-white/10 px-1 rounded text-white backdrop-blur">
                                {Math.round(creationRect.width)} x {Math.round(creationRect.height)}
                            </span>
                         </div>
                    )}
                    
                    {layers.length === 0 && !isDragging && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-300">
                            <div className="bg-black/80 text-white px-5 py-3 rounded-full text-xs backdrop-blur-md flex items-center gap-3 border border-white/20 shadow-2xl">
                                <MousePointer2 size={16} className="animate-bounce text-indigo-400" />
                                <span className="font-medium tracking-wide">{t.dragHint}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* --- RIGHT SIDEBAR (Export) --- */}
      <div className="w-full lg:w-[300px] bg-[#0F1623]/80 border-t lg:border-t-0 lg:border-l border-white/5 p-6 flex flex-col gap-6 shadow-2xl z-20 shrink-0 overflow-y-auto max-h-[30vh] lg:max-h-full backdrop-blur-xl order-3 lg:order-3">
             {/* ... (Existing Right Sidebar) ... */}
             <div className="space-y-5">
                 <div className="space-y-2">
                    <label className="flex items-center gap-2 text-slate-300 text-sm font-bold uppercase tracking-wider">
                        <FileText size={16} className="text-indigo-400"/> {t.filename} 
                    </label>
                    <div className="flex items-center bg-white/5 border border-white/10 rounded-xl overflow-hidden focus-within:border-indigo-500/50 transition-colors shadow-inner">
                        <input type="text" value={outputFilename} onChange={(e) => setOutputFilename(e.target.value)} className="w-full bg-transparent p-3.5 text-white outline-none text-sm font-mono" />
                        <span className="text-slate-500 text-xs px-4 bg-white/5 h-full flex items-center border-l border-white/5">.svga</span>
                    </div>
                     <div className="text-right">
                       <span className="text-slate-500 text-[10px]">{t.remarkEnglish}</span>
                    </div>
                </div>

                <div className="bg-black/40 p-3 rounded-xl border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-300">
                        <FileCode size={16} className="text-emerald-400" /> <span className="text-xs font-medium">{t.compress}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={compressOutput} onChange={(e) => setCompressOutput(e.target.checked)} />
                        <div className="w-10 h-5 bg-slate-700/50 rounded-full peer peer-checked:bg-indigo-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all shadow-inner"></div>
                    </label>
                </div>
             </div>

             <div className="lg:mt-auto flex flex-col gap-3">
                 <button
                    onClick={openThumbnailModal}
                    disabled={isProcessing}
                    className="flex items-center justify-center gap-2.5 w-full py-3 rounded-xl font-bold text-xs tracking-wide bg-white/10 hover:bg-white/20 text-white transition-all duration-300 border border-white/10 shadow-sm"
                 >
                    <Camera size={16} className="text-indigo-300" />
                    {t.exportThumb}
                 </button>

                 <button
                    onClick={handleExport}
                    disabled={layers.length === 0 || isProcessing}
                    className={`group flex items-center justify-center gap-2.5 w-full py-4 rounded-xl font-bold text-sm tracking-wide transition-all duration-300 ${
                        layers.length === 0 || isProcessing
                        ? "bg-white/5 text-slate-500 cursor-not-allowed border border-white/5" 
                        : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/40 hover:shadow-indigo-600/30 border border-indigo-400/20"
                    }`}
                 >
                    <Download size={18} className={`transition-transform ${isProcessing ? 'animate-bounce' : 'group-hover:scale-110'}`} />
                    {isProcessing ? t.processing : t.export}
                 </button>
                 
                 <div className="flex gap-2">
                    <button onClick={clearAllLayers} className="flex-1 py-2 text-xs text-slate-500 hover:text-red-300 transition-colors border border-dashed border-white/10 rounded-lg hover:border-red-400/30 hover:bg-red-500/10 flex items-center justify-center gap-1.5" title={t.clearCanvas}>
                        <Eraser size={14} /> {t.clearCanvas}
                    </button>
                    <button onClick={onReset} className="flex-1 py-2 text-xs text-slate-500 hover:text-white transition-colors border border-dashed border-white/10 rounded-lg hover:border-white/30 hover:bg-white/5">
                        {t.openDiff}
                    </button>
                 </div>
            </div>
      </div>
    </div>
  );
};

export default SvgaEditor;
