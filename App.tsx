import React, { useState } from "react";
import SvgaUploader from "./components/SvgaUploader";
import SvgaEditor from "./components/SvgaEditor";
import { ProcessedSvga, Language } from "./types";

const App: React.FC = () => {
  const [svgaData, setSvgaData] = useState<ProcessedSvga | null>(null);
  // Default language set to Chinese as requested
  const [language, setLanguage] = useState<Language>('zh');

  const handleUpload = (data: ProcessedSvga) => {
    setSvgaData(data);
  };

  const handleReset = () => {
    setSvgaData(null);
  };

  return (
    <div className="min-h-screen bg-[#0A0F1C] text-slate-200 font-sans selection:bg-indigo-500/30">
      {svgaData ? (
        <SvgaEditor 
            processedSvga={svgaData} 
            onReset={handleReset} 
            language={language}
        />
      ) : (
        <SvgaUploader 
            onUpload={handleUpload} 
            language={language}
            setLanguage={setLanguage}
        />
      )}
    </div>
  );
};

export default App;
