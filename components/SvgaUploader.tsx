
import React, { useCallback, useState } from "react";
import { Upload, FileType, AlertCircle } from "lucide-react";
import { ProcessedSvga, Language } from "../types";
import { decodeSvga } from "../services/svgaService";

interface SvgaUploaderProps {
  onUpload: (data: ProcessedSvga) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
}

const TEXT = {
    en: {
        title: "SVGA Key Injector",
        subtitle: "Upload SVGA animation, select area, inject named placeholder key.",
        dragDrop: "Drag & Drop SVGA File Here",
        browse: "or click to browse",
        support: "Supports SVGA 1.x / 2.0",
        parsing: "Parsing Structure...",
        errorParams: "Invalid file type. Please upload .svga",
        errorParse: "Failed to parse SVGA. File might be corrupted.",
    },
    zh: {
        title: "SVGA 动态图层注入工具",
        subtitle: "上传 SVGA 动画，框选区域并注入可替换的动态 Key 图层。",
        dragDrop: "拖拽 SVGA 文件到任意位置",
        browse: "或点击选择文件",
        support: "支持 SVGA 1.x / 2.0 格式",
        parsing: "正在解析文件结构...",
        errorParams: "文件类型错误，请上传 .svga 后缀的文件",
        errorParse: "解析失败，文件可能已损坏或格式不兼容",
    }
};

const SvgaUploader: React.FC<SvgaUploaderProps> = ({ onUpload, language, setLanguage }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const t = TEXT[language];

  const processFile = async (file: File) => {
    setError(null);
    const fileName = file.name.trim();
    
    if (!fileName.toLowerCase().endsWith(".svga")) {
      setError(t.errorParams);
      return;
    }

    setIsLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const svgaData = await decodeSvga(buffer);
      
      const processed: ProcessedSvga = {
        buffer,
        data: svgaData,
        url: URL.createObjectURL(file),
        filename: fileName,
      };
      
      onUpload(processed);
    } catch (err: any) {
      console.error(err);
      setError(err.message || t.errorParse);
    } finally {
      setIsLoading(false);
    }
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only set to false if we are leaving the main container
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div 
        className="relative flex flex-col items-center justify-center min-h-[100dvh] bg-[#0A0F1C] text-white p-6 overflow-hidden"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
    >
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Language Toggle */}
      <div className="absolute top-6 right-6 flex items-center bg-white/5 backdrop-blur-md rounded-full p-1 border border-white/10 z-20">
          <button 
            onClick={() => setLanguage('zh')}
            className={`px-3 py-1 text-xs rounded-full transition-all duration-300 ${language === 'zh' ? 'bg-white/10 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            中文
          </button>
          <button 
            onClick={() => setLanguage('en')}
            className={`px-3 py-1 text-xs rounded-full transition-all duration-300 ${language === 'en' ? 'bg-white/10 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            EN
          </button>
      </div>

      <div className="w-full max-w-xl text-center mb-10 z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent mb-4 tracking-tight">
          {t.title}
        </h1>
        <p className="text-slate-400 text-sm md:text-base px-2 font-light tracking-wide">
          {t.subtitle}
        </p>
      </div>

      <div
        className={`
          group w-full max-w-xl aspect-[16/9] rounded-3xl border border-dashed transition-all duration-500 ease-out
          flex flex-col items-center justify-center cursor-pointer relative overflow-hidden backdrop-blur-sm z-10
          ${
            isDragging
              ? "border-blue-400/50 bg-blue-500/10 scale-[1.01] shadow-[0_0_40px_rgba(59,130,246,0.2)]"
              : "border-slate-700/50 bg-white/[0.02] hover:bg-white/[0.04] hover:border-slate-600 shadow-2xl shadow-black/40"
          }
        `}
      >
        <input
          type="file"
          accept=".svga"
          onChange={onInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />

        <div className="flex flex-col items-center pointer-events-none p-6 transition-transform duration-500 group-hover:scale-105">
          {isLoading ? (
            <div className="flex flex-col items-center">
                <div className="relative w-16 h-16 mb-4">
                    <div className="absolute inset-0 rounded-full border-2 border-slate-700"></div>
                    <div className="absolute inset-0 rounded-full border-t-2 border-blue-400 animate-spin"></div>
                </div>
                <p className="text-base font-medium text-slate-300 animate-pulse">{t.parsing}</p>
            </div>
          ) : (
            <>
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner ring-1 ring-white/10 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-shadow duration-500">
                 <Upload size={32} className="text-blue-200 opacity-90" />
              </div>
              <h3 className="text-xl font-medium mb-2 text-slate-200 tracking-wide">
                {t.dragDrop}
              </h3>
              <p className="text-slate-500 text-sm mb-8 font-light">
                {t.browse}
              </p>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-white/5 px-4 py-1.5 rounded-full border border-white/5 uppercase tracking-wider">
                <FileType size={12} />
                <span>{t.support}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Full Screen Drop Overlay */}
      {isDragging && (
          <div className="absolute inset-0 z-50 bg-blue-900/40 backdrop-blur-md flex items-center justify-center border-4 border-blue-500 border-dashed m-4 rounded-3xl animate-in fade-in duration-200 pointer-events-none">
              <div className="text-center">
                  <Upload size={64} className="text-white mx-auto mb-4 animate-bounce" />
                  <h2 className="text-2xl font-bold text-white">{t.dragDrop}</h2>
              </div>
          </div>
      )}

      {error && (
        <div className="mt-8 flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-300 px-5 py-3 rounded-xl max-w-md w-full animate-in fade-in slide-in-from-bottom-2 backdrop-blur-md">
            <AlertCircle size={20} className="shrink-0" />
            <span className="text-sm break-words flex-1 font-medium">{error}</span>
        </div>
      )}
    </div>
  );
};

export default SvgaUploader;
