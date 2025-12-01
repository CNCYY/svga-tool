import React, { useEffect, useRef, useState, useMemo } from "react";
import { ProcessedSvga, Rect, AnimationPreset, Language } from "../types";
import { addPlaceholderToSvga, encodeSvga, sanitizeImagesTo32Bit, generateTextBitmap, processUploadedImage, calcTextSize } from "../services/svgaService";
import { Download, Play, Pause, Layers, MousePointer2, FileCode, Clock, FileText, Type, SquareDashed, XCircle, Grid3X3, Image as ImageIcon, Upload, Activity, Palette, Sparkles, Move } from "lucide-react";

interface SvgaEditorProps {
  processedSvga: ProcessedSvga;
  onReset: () => void;
  language: Language;
}

type LayerType = 'key' | 'text' | 'image';

// Localization Dictionary
const I18N = {
    en: {
        layerType: "Layer Type",
        typeKey: "Dynamic Key",
        typeText: "Static Text",
        typeImage: "Static Image",
        layerName: "Layer Name / Key",
        recent: "Recent:",
        animation: "Animation Effect",
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
        dragHint: "Drag on canvas to create layer",
        filename: "Output Filename",
        compress: "Compress Output",
        export: "Export SVGA",
        processing: "Processing...",
        openDiff: "Open Different File",
        frame: "Frame",
        placeholderText: "Enter text...",
        placeholderKey: "e.g. img_01",
        remarkEnglish: "(Input English Name)"
    },
    zh: {
        layerType: "图层类型",
        typeKey: "动态 Key",
        typeText: "固定文字",
        typeImage: "固定图片",
        layerName: "图层名称 / Key",
        recent: "最近使用:",
        animation: "动画效果",
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
        dragHint: "在画布上拖拽以创建图层",
        filename: "导出文件名",
        compress: "开启压缩",
        export: "导出 SVGA",
        processing: "处理中...",
        openDiff: "打开其他文件",
        frame: "帧",
        placeholderText: "输入文本...",
        placeholderKey: "例如：avatar_01",
        remarkEnglish: "(请输入英文名)"
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
    <h3 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2 uppercase tracking-wide">
        {Icon && <Icon size={12} />} {title} {children}
    </h3>
);

const InputLabel = ({ children }: { children?: React.ReactNode }) => (
    <label className="text-[10px] text-slate-500 font-bold uppercase">{children}</label>
);

const StyledInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input 
        {...props}
        className={`bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all ${props.className || ''}`}
    />
);

const SvgaEditor: React.FC<SvgaEditorProps> = ({ processedSvga, onReset, language }) => {
  const t = I18N[language];
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [player, setPlayer] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  
  // Selection
  const [currentSelection, setCurrentSelection] = useState<Rect | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [interactionMode, setInteractionMode] = useState<'create' | 'move'>('create');
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Configuration
  const [layerType, setLayerType] = useState<LayerType>('key');
  const [layerKey, setLayerKey] = useState("avatar_key");

  // Animation
  const [animationPreset, setAnimationPreset] = useState<AnimationPreset>('none');
  const [animCycles, setAnimCycles] = useState(1);
  const [animIntensity, setAnimIntensity] = useState(1.0);

  // Text
  const [textContent, setTextContent] = useState(language === 'zh' ? "输入文字" : "Your Text");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textSize, setTextSize] = useState(24);
  const [fontFamily, setFontFamily] = useState("sans-serif");
  
  // Gradient
  const [isGradient, setIsGradient] = useState(false);
  const [gradientStart, setGradientStart] = useState("#FFD700");
  const [gradientEnd, setGradientEnd] = useState("#FFA500");
  
  // Image
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  
  // Preview
  const [textPreviewUrl, setTextPreviewUrl] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [compressOutput, setCompressOutput] = useState(true);

  // Misc
  const [recentKeys, setRecentKeys] = useState<string[]>([]);
  const [outputFilename, setOutputFilename] = useState("");
  const [svgaWidth, setSvgaWidth] = useState(processedSvga.data.params.viewBoxWidth);
  const [svgaHeight, setSvgaHeight] = useState(processedSvga.data.params.viewBoxHeight);
  const [scaleFactor, setScaleFactor] = useState(1);

  // Calculated Params
  const fps = processedSvga.data.params.fps || 20;
  const svgaDuration = totalFrames > 0 ? totalFrames / fps : 0;
  const animCycleDuration = svgaDuration && svgaDuration > 0 ? svgaDuration / animCycles : 1; 
  const shineDuration = svgaDuration && svgaDuration > 0 ? svgaDuration / animCycles : 2;

  // Effects
  useEffect(() => {
      const saved = localStorage.getItem("svga_recent_keys");
      if (saved) {
          try { setRecentKeys(JSON.parse(saved)); } catch (e) {}
      }
      const base = processedSvga.filename.replace(/\.svga$/i, "");
      setOutputFilename(`${base}_patched`);
  }, [processedSvga.filename]);

  const bitmapRefRect = useMemo(() => {
      if (!currentSelection) return { width: 0, height: 0 };
      return { width: currentSelection.width, height: currentSelection.height };
  }, [currentSelection?.width, currentSelection?.height]);

  useEffect(() => {
    if (layerType === 'text' && bitmapRefRect.width > 0 && bitmapRefRect.height > 0) {
        let active = true;
        const gen = async () => {
            const bytes = await generateTextBitmap(
                textContent, textSize, fontFamily,
                bitmapRefRect.width, bitmapRefRect.height,
                isGradient ? gradientStart : textColor,
                isGradient, gradientEnd
            );
            if (!active) return;
            const blob = new Blob([bytes], { type: 'image/png' });
            const url = URL.createObjectURL(blob);
            setTextPreviewUrl(url);
        };
        gen();
        return () => { active = false; if (textPreviewUrl) URL.revokeObjectURL(textPreviewUrl); };
    } else {
        if (layerType !== 'text') setTextPreviewUrl(null);
    }
  }, [textContent, textSize, textColor, fontFamily, isGradient, gradientStart, gradientEnd, layerType, bitmapRefRect.width, bitmapRefRect.height]);

  useEffect(() => {
    if (!canvasRef.current || !processedSvga.url) return;
    if (player) player.clear();
    const { SVGA } = window;
    if (!SVGA) return;

    try {
        const parser = new SVGA.Parser();
        const newPlayer = new SVGA.Player(canvasRef.current);
        newPlayer.loops = 0;
        newPlayer.clearsAfterStop = false;
        newPlayer.setContentMode("Fill");
        newPlayer.onFrame((frame: number) => setCurrentFrame(frame));

        parser.load(processedSvga.url, (videoItem: any) => {
          if (videoItem.videoSize && (videoItem.videoSize.width !== svgaWidth || videoItem.videoSize.height !== svgaHeight)) {
              setSvgaWidth(videoItem.videoSize.width);
              setSvgaHeight(videoItem.videoSize.height);
          }
          setTotalFrames(videoItem.frames);
          newPlayer.setVideoItem(videoItem);
          newPlayer.startAnimation();
          setPlayer(newPlayer);
        });
    } catch (e) { console.error(e); }
  }, [processedSvga.url]);

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

  // Interaction
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

    // Hit test logic: Check if clicking inside existing selection to move
    if (currentSelection) {
        const { x, y, width, height } = currentSelection;
        if (coords.x >= x && coords.x <= x + width && coords.y >= y && coords.y <= y + height) {
            setInteractionMode('move');
            setDragOffset({ x: coords.x - x, y: coords.y - y });
            setIsDragging(true);
            return;
        }
    }

    // Default: Create new selection
    setInteractionMode('create');
    setStartPoint(coords);
    setIsDragging(true);
    setCurrentSelection({ x: coords.x, y: coords.y, width: 0, height: 0 });
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const coords = getSvgaCoordinates(e);

    if (interactionMode === 'move' && currentSelection) {
        const newX = coords.x - dragOffset.x;
        const newY = coords.y - dragOffset.y;
        setCurrentSelection({ ...currentSelection, x: newX, y: newY });
    } else if (startPoint) {
        const x = Math.min(coords.x, startPoint.x);
        const y = Math.min(coords.y, startPoint.y);
        const width = Math.abs(coords.x - startPoint.x);
        const height = Math.abs(coords.y - startPoint.y);
        setCurrentSelection({ x, y, width, height });
    }
  };

  const handlePointerUp = () => setIsDragging(false);

  const updateSelection = (field: keyof Rect, value: string) => {
      const numVal = parseFloat(value);
      if (isNaN(numVal) || !currentSelection) return;
      setCurrentSelection(prev => ({ ...prev!, [field]: numVal }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setUploadedImage(file);
          setUploadedImagePreview(URL.createObjectURL(file));
      }
  };

  const handleExport = async () => {
    if (!layerKey) return;
    setIsProcessing(true);
    try {
      if (!currentSelection) throw new Error("No selection made.");
      let customImageBytes: Uint8Array | undefined = undefined;

      if (layerType === 'text') {
           customImageBytes = await generateTextBitmap(
              textContent, textSize, fontFamily, 
              currentSelection.width, currentSelection.height,
              isGradient ? gradientStart : textColor,
              isGradient, gradientEnd
           );
      } else if (layerType === 'image') {
          if (!uploadedImage) throw new Error("Upload image first.");
          customImageBytes = await processUploadedImage(uploadedImage, currentSelection.width, currentSelection.height);
      }

      const newData = await addPlaceholderToSvga(
          { ...processedSvga.data, params: { ...processedSvga.data.params, viewBoxWidth: svgaWidth, viewBoxHeight: svgaHeight } }, 
          currentSelection, layerKey, customImageBytes, animationPreset, { cycles: animCycles, intensity: animIntensity }
      );
      
      if (newData.images) newData.images = await sanitizeImagesTo32Bit(newData.images);
      const bytes = encodeSvga(newData, compressOutput);
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

      const newHistory = [layerKey, ...recentKeys.filter(k => k !== layerKey)].slice(0, 5);
      setRecentKeys(newHistory);
      localStorage.setItem("svga_recent_keys", JSON.stringify(newHistory));
    } catch (err: any) { alert(err.message); } 
    finally { setIsProcessing(false); }
  };

  return (
    <div className="flex flex-col-reverse lg:flex-row h-[100dvh] bg-[#0A0F1C] overflow-hidden text-slate-200">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bangers&family=Pacifico&family=Playfair+Display:wght@700&family=Roboto:wght@700&display=swap');
        @keyframes pulse-preview { 0%, 100% { transform: scale(1); } 50% { transform: scale(${1 + (0.1 * animIntensity)}); } }
        @keyframes float-preview { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(${6 * scaleFactor * animIntensity}px); } }
        @keyframes shine-slide { 0% { transform: translateX(-100%) skewX(-30deg); } 100% { transform: translateX(100%) skewX(-30deg); } }
      `}</style>

      {/* --- SIDEBAR --- */}
      <div className="w-full lg:w-[450px] bg-[#0F1623]/80 border-t lg:border-t-0 lg:border-r border-white/5 p-5 flex flex-col gap-6 shadow-2xl z-20 shrink-0 overflow-y-auto max-h-[45vh] lg:max-h-full backdrop-blur-md">
        
        {/* 1. Layer Type */}
        <div className="space-y-2">
            <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                <Layers size={12} /> {t.layerType}
            </label>
            <div className="flex bg-black/20 p-1 rounded-xl border border-white/5">
                {[
                    { id: 'key', icon: Grid3X3, label: t.typeKey, key: 'avatar_key' },
                    { id: 'text', icon: Type, label: t.typeText, key: 'text_label' },
                    { id: 'image', icon: ImageIcon, label: t.typeImage, key: 'art_01' }
                ].map((type) => (
                    <button 
                        key={type.id}
                        onClick={() => { setLayerType(type.id as LayerType); setLayerKey(type.key); }}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-[10px] lg:text-xs font-medium transition-all duration-200 ${layerType === type.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <type.icon size={14} /> {type.label}
                    </button>
                ))}
            </div>
        </div>

        {/* 2. Key Input */}
        <div className="space-y-2">
            <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{t.layerName}</label>
            <StyledInput 
                type="text" 
                value={layerKey}
                onChange={(e) => setLayerKey(e.target.value.replace(/\s/g, "_"))}
                placeholder={t.placeholderKey}
                className="w-full"
            />
            {layerType === 'key' && recentKeys.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                    <span className="text-[10px] text-slate-500 w-full mb-0.5 flex items-center gap-1"><Clock size={10}/> {t.recent}</span>
                    {recentKeys.map(key => (
                        <button key={key} onClick={() => setLayerKey(key)} className="text-[10px] bg-white/5 hover:bg-white/10 text-slate-300 px-2 py-1 rounded-md border border-white/5 transition-colors">
                            {key}
                        </button>
                    ))}
                </div>
            )}
        </div>

        {/* 3. Animation Controls */}
        {(layerType === 'text' || layerType === 'image') && (
            <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <SectionHeader icon={Sparkles} title={t.animation}>
                     <span className="text-yellow-400">✨</span>
                </SectionHeader>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { id: 'none', label: t.animNone },
                        { id: 'pulse', label: t.animPulse },
                        { id: 'float', label: t.animFloat },
                        { id: 'shine', label: t.animShine }
                    ].map(anim => (
                        <button 
                            key={anim.id}
                            onClick={() => setAnimationPreset(anim.id as AnimationPreset)}
                            className={`text-[10px] py-2 px-1 rounded-lg border transition-all duration-200 ${animationPreset === anim.id ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200' : 'bg-transparent border-transparent text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
                        >
                            {anim.label}
                        </button>
                    ))}
                </div>
                {animationPreset !== 'none' && (
                    <div className="space-y-3 pt-2 border-t border-white/5">
                        {[
                            { label: t.animFreq, val: animCycles, set: setAnimCycles, min: 0.5, max: 3 },
                            { label: t.animIntense, val: animIntensity, set: setAnimIntensity, min: 0.5, max: 2 }
                        ].map(ctrl => (
                            <div key={ctrl.label}>
                                <div className="flex justify-between mb-1">
                                    <InputLabel>{ctrl.label}</InputLabel>
                                    <span className="text-[10px] font-mono text-indigo-400">{ctrl.val}</span>
                                </div>
                                <input 
                                    type="range" min={ctrl.min} max={ctrl.max} step="0.1" 
                                    value={ctrl.val} onChange={(e) => ctrl.set(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* 4. Text Settings */}
        {layerType === 'text' && (
            <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                 <div className="space-y-2">
                    <InputLabel>{t.textContent}</InputLabel>
                    <StyledInput 
                        type="text" value={textContent} onChange={(e) => setTextContent(e.target.value)}
                        placeholder={t.placeholderText} className="w-full px-3 py-2 text-sm"
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                     <div className="space-y-1">
                        <InputLabel>{t.textSize}</InputLabel>
                        <StyledInput type="number" value={textSize} onChange={(e) => setTextSize(parseInt(e.target.value))} className="w-full" />
                     </div>
                     <div className="space-y-1">
                        <InputLabel>{t.fontFamily}</InputLabel>
                        <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg px-1 py-1.5 text-xs text-white outline-none focus:border-indigo-500/50 h-[30px]">
                            {FONT_OPTIONS.map(font => <option key={font.value} value={font.value}>{font.name}</option>)}
                        </select>
                     </div>
                 </div>
                 <div className="pt-2 border-t border-white/5 space-y-3">
                    <div className="flex justify-between items-center">
                        <InputLabel><span className="flex items-center gap-1"><Palette size={10} /> {t.fillStyle}</span></InputLabel>
                        <button onClick={() => setIsGradient(!isGradient)} className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded text-slate-300 transition-colors border border-white/5">
                            {isGradient ? t.gradient : t.solid}
                        </button>
                    </div>
                    {!isGradient ? (
                        <div className="flex items-center justify-between bg-black/20 border border-white/10 rounded-lg p-2">
                             <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="h-6 w-8 bg-transparent border-0 cursor-pointer" />
                             <span className="text-xs font-mono text-slate-400">{textColor}</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {[ { l: t.topColor, v: gradientStart, s: setGradientStart }, { l: t.bottomColor, v: gradientEnd, s: setGradientEnd } ].map(c => (
                                <div key={c.l} className="bg-black/20 border border-white/10 rounded-lg p-2 flex flex-col gap-1">
                                    <span className="text-[9px] text-slate-500 uppercase">{c.l}</span>
                                    <div className="flex items-center gap-2">
                                        <input type="color" value={c.v} onChange={(e) => c.s(e.target.value)} className="h-5 w-5 bg-transparent border-0 cursor-pointer" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                 </div>
            </div>
        )}

        {/* 5. Image Upload */}
        {layerType === 'image' && (
             <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5 space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
                <SectionHeader icon={ImageIcon} title={t.uploadImg} />
                <div onClick={() => fileInputRef.current?.click()} className="group border border-dashed border-white/10 bg-black/20 hover:bg-black/40 hover:border-indigo-500/50 rounded-xl p-4 cursor-pointer flex flex-col items-center text-center transition-all duration-300">
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleImageUpload} />
                    {uploadedImagePreview ? (
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-16 h-16 rounded-lg border border-white/10 overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
                                <img src={uploadedImagePreview} alt="Preview" className="w-full h-full object-contain" />
                            </div>
                            <span className="text-[10px] text-slate-400 truncate w-32">{uploadedImage?.name}</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-500 group-hover:text-indigo-400 transition-colors">
                            <Upload size={20} />
                            <span className="text-xs">{t.clickUpload}</span>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* 6. Geometry */}
        <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5">
            <SectionHeader icon={SquareDashed} title={t.geometry} />
            {currentSelection ? (
                <div className="grid grid-cols-2 gap-3">
                    {['x', 'y', 'width', 'height'].map((k) => (
                        <div key={k} className="flex flex-col gap-1">
                             <InputLabel>{k === 'width' ? 'W' : k === 'height' ? 'H' : k.toUpperCase()}</InputLabel>
                             <StyledInput 
                                type="number" 
                                value={Math.round((currentSelection as any)[k] * 100) / 100} 
                                onChange={(e) => updateSelection(k as keyof Rect, e.target.value)} 
                                className="text-indigo-300 font-mono"
                             />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-slate-500 text-xs italic py-4 text-center border border-dashed border-white/5 rounded-xl bg-black/10">
                    {t.dragHint}
                </div>
            )}
        </div>

        {/* 7. Footer Actions */}
        <div className="space-y-4 pt-4 border-t border-white/5 mt-auto">
             <div className="space-y-2">
                <label className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <FileText size={12}/> {t.filename} <span className="text-slate-500 normal-case font-normal ml-auto text-[10px]">{t.remarkEnglish}</span>
                </label>
                <div className="flex items-center bg-black/20 border border-white/10 rounded-xl overflow-hidden focus-within:border-indigo-500/50 transition-colors">
                    <input type="text" value={outputFilename} onChange={(e) => setOutputFilename(e.target.value)} className="w-full bg-transparent p-3 text-white outline-none text-xs font-mono" />
                    <span className="text-slate-500 text-[10px] px-3 bg-white/5 h-full flex items-center border-l border-white/5">.svga</span>
                </div>
            </div>

            <div className="bg-black/20 p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                    <FileCode size={14} /> <span className="text-xs font-medium">{t.compress}</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={compressOutput} onChange={(e) => setCompressOutput(e.target.checked)} />
                    <div className="w-9 h-5 bg-slate-700/50 rounded-full peer peer-checked:bg-indigo-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all shadow-inner"></div>
                </label>
            </div>
        </div>
        
        <div className="lg:flex-1 hidden lg:block"></div>

        <div className="flex flex-col gap-3">
             <button
                onClick={handleExport}
                disabled={!currentSelection || !layerKey || isProcessing || (layerType === 'image' && !uploadedImage)}
                className={`group flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 ${
                    !currentSelection || !layerKey || isProcessing || (layerType === 'image' && !uploadedImage)
                    ? "bg-white/5 text-slate-600 cursor-not-allowed border border-white/5" 
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/40 hover:shadow-indigo-600/30 border border-indigo-400/20"
                }`}
             >
                <Download size={16} className={`transition-transform ${isProcessing ? 'animate-bounce' : 'group-hover:scale-110'}`} />
                {isProcessing ? t.processing : t.export}
             </button>
             
             <button onClick={onReset} className="w-full py-3 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                {t.openDiff}
             </button>
        </div>
      </div>

      {/* --- MAIN CANVAS AREA --- */}
      <div className="flex-1 flex flex-col h-full min-h-0 relative bg-[#0B0F17]">
        {/* Toolbar */}
        <div className="h-16 bg-[#0F1623]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-10 gap-6 shadow-sm">
            <div className="flex items-center gap-4 flex-1">
                 <button onClick={togglePlay} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-white transition-all hover:scale-105 active:scale-95 border border-white/5">
                     {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                 </button>
                 <div className="flex-1 flex flex-col gap-1.5 max-w-md">
                     <div className="flex justify-between text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                         <span>{t.frame} {currentFrame}</span>
                         <span>{totalFrames}</span>
                     </div>
                     <div className="relative h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full transition-all duration-75" style={{ width: `${(currentFrame / (totalFrames - 1 || 1)) * 100}%` }}></div>
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
                className="relative shadow-2xl shadow-black ring-1 ring-slate-700/50 bg-[#161b22] shrink-0 transition-shadow duration-500 hover:shadow-indigo-900/10"
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
                    {currentSelection && (
                        <div 
                            className={`absolute flex items-center justify-center pointer-events-auto cursor-move group`}
                            style={{
                                left: currentSelection.x * scaleFactor,
                                top: currentSelection.y * scaleFactor,
                                width: currentSelection.width * scaleFactor,
                                height: currentSelection.height * scaleFactor,
                            }}
                        >
                            <div className="absolute inset-0 ring-1 ring-blue-500/80 bg-blue-500/10 z-10 pointer-events-none shadow-[0_0_15px_rgba(59,130,246,0.2)] backdrop-brightness-110"></div>
                            
                            {/* Center Move Handle */}
                             <div className="absolute inset-0 flex items-center justify-center z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                                <div className="bg-blue-600/50 backdrop-blur-md p-2 rounded-full border border-white/30 shadow-lg">
                                    <Move size={20} className="text-white drop-shadow-md" />
                                </div>
                            </div>
                            
                            <div className="w-full h-full relative pointer-events-none" style={{ animation: animationPreset === 'pulse' ? `pulse-preview ${animCycleDuration}s ease-in-out infinite` : animationPreset === 'float' ? `float-preview ${animCycleDuration}s ease-in-out infinite` : 'none' }}>
                                {layerType === 'text' && textPreviewUrl && <img src={textPreviewUrl} alt="Preview" className="w-full h-full object-contain pointer-events-none opacity-90 drop-shadow-lg" />}
                                {layerType === 'image' && uploadedImagePreview && <img src={uploadedImagePreview} alt="Preview" className="w-full h-full object-contain pointer-events-none opacity-90 drop-shadow-lg" />}
                            </div>

                            {animationPreset === 'shine' && (
                                <div className="absolute inset-0 overflow-hidden mix-blend-overlay pointer-events-none">
                                    <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] opacity-80" style={{ background: 'linear-gradient(90deg, transparent 40%, rgba(255,255,255,0.8) 50%, transparent 60%)', animation: `shine-slide ${shineDuration}s linear infinite` }}></div>
                                </div>
                            )}

                            <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 absolute -top-5 left-0 whitespace-nowrap rounded shadow-sm opacity-90 z-20 uppercase tracking-wide pointer-events-none">
                                {layerType === 'text' ? 'TEXT' : layerType === 'image' ? 'IMG' : 'KEY'} • {layerKey}
                            </span>
                        </div>
                    )}
                    
                    {!currentSelection && !isDragging && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-300">
                            <div className="bg-black/60 text-white px-4 py-2 rounded-full text-xs backdrop-blur-md flex items-center gap-2 border border-white/10 shadow-xl">
                                <MousePointer2 size={14} className="animate-bounce" />
                                {t.dragHint}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SvgaEditor;