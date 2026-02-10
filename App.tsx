
import React, { useState, useRef, useEffect } from 'react';
import { generateMemeCaptions, analyzeImageContext, editImageWithPrompt, fileToB64 } from './services/geminiService';
import { MemeCaption, Template, AppStatus, AnalysisResult } from './types';
import { Spinner } from './components/Spinner';

// Sample trending templates
const TEMPLATES: Template[] = [
  { id: '1', name: 'Distracted Boyfriend', url: 'https://picsum.photos/id/10/800/600' },
  { id: '2', name: 'Two Buttons', url: 'https://picsum.photos/id/20/800/600' },
  { id: '3', name: 'Drake Hotline', url: 'https://picsum.photos/id/30/800/600' },
  { id: '4', name: 'Change My Mind', url: 'https://picsum.photos/id/40/800/600' },
];

const App: React.FC = () => {
  // State
  const [currentImage, setCurrentImage] = useState<string | null>(null); // Base64 string
  const [captions, setCaptions] = useState<MemeCaption[]>([]);
  const [selectedCaptionId, setSelectedCaptionId] = useState<string | null>(null);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [suggestedCaptions, setSuggestedCaptions] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [activeTab, setActiveTab] = useState<'caption' | 'edit' | 'analyze' | 'style'>('caption');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Handlers
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const b64 = await fileToB64(file);
        setCurrentImage(b64);
        resetState();
      } catch (err) {
        console.error("Upload failed", err);
      }
    }
  };

  const handleSelectTemplate = async (url: string) => {
    try {
        // Fetch the image and convert to blob then base64 to have a consistent format
        const response = await fetch(url);
        const blob = await response.blob();
        const b64 = await fileToB64(blob);
        setCurrentImage(b64);
        resetState();
    } catch (e) {
        console.error("Failed to load template", e);
    }
  };

  const handleDownload = async () => {
    if (!currentImage || !imageRef.current) return;

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = `data:image/png;base64,${currentImage}`;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      ctx.drawImage(img, 0, 0);

      const displayWidth = imageRef.current.width;
      const scale = img.naturalWidth / displayWidth;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;

      captions.forEach(caption => {
        const x = (caption.x / 100) * canvas.width;
        const y = (caption.y / 100) * canvas.height;
        
        // Scale font size to match natural image size
        const actualFontSize = caption.fontSize * scale;

        ctx.font = `${actualFontSize}px "Bangers", cursive`;
        ctx.fillStyle = caption.color;
        ctx.strokeStyle = caption.strokeColor;
        ctx.lineWidth = (caption.strokeWidth * scale); 

        // Draw stroke first
        ctx.strokeText(caption.text.toUpperCase(), x, y);
        // Then fill
        ctx.fillText(caption.text.toUpperCase(), x, y);
      });

      const link = document.createElement('a');
      link.download = `meme-genius-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error("Failed to generate download", e);
    }
  };

  const resetState = () => {
    setCaptions([]);
    setSuggestedCaptions([]);
    setAnalysis(null);
    setEditPrompt('');
    setStatus(AppStatus.IDLE);
    setSelectedCaptionId(null);
    setActiveTab('caption');
  };

  // --- GEMINI FEATURES ---

  const handleMagicCaption = async () => {
    if (!currentImage) return;
    setStatus(AppStatus.GENERATING_CAPTIONS);
    try {
      const suggestions = await generateMemeCaptions(currentImage);
      setSuggestedCaptions(suggestions);
      setActiveTab('caption');
      setStatus(AppStatus.SUCCESS);
    } catch (e) {
      setStatus(AppStatus.ERROR);
    }
  };

  const handleAnalyze = async () => {
    if (!currentImage) return;
    setStatus(AppStatus.ANALYZING);
    try {
      const result = await analyzeImageContext(currentImage);
      setAnalysis(result);
      setActiveTab('analyze');
      setStatus(AppStatus.SUCCESS);
    } catch (e) {
      setStatus(AppStatus.ERROR);
    }
  };

  const handleEditImage = async () => {
    if (!currentImage || !editPrompt.trim()) return;
    setStatus(AppStatus.EDITING_IMAGE);
    try {
      const newImageB64 = await editImageWithPrompt(currentImage, editPrompt);
      setCurrentImage(newImageB64);
      setEditPrompt(''); // Clear prompt after success
      setStatus(AppStatus.SUCCESS);
    } catch (e) {
      setStatus(AppStatus.ERROR);
    }
  };

  // --- EDITOR INTERACTION ---

  const addCaption = (text: string) => {
    // Calculate a reasonable default font size based on image width
    const defaultFontSize = imageRef.current ? Math.max(24, imageRef.current.width / 10) : 40;

    const newCaption: MemeCaption = {
      id: Date.now().toString(),
      text,
      x: 50, // Center percentage
      y: captions.length === 0 ? 15 : 85, // Top for first, bottom for second
      color: '#ffffff',
      fontSize: defaultFontSize,
      strokeColor: '#000000',
      strokeWidth: defaultFontSize / 8
    };
    setCaptions([...captions, newCaption]);
    setSelectedCaptionId(newCaption.id);
    setActiveTab('style');
  };

  const updateCaptionPosition = (id: string, x: number, y: number) => {
     setCaptions(captions.map(c => c.id === id ? { ...c, x, y } : c));
  };

  const updateSelectedCaption = (updates: Partial<MemeCaption>) => {
    if (!selectedCaptionId) return;
    setCaptions(captions.map(c => c.id === selectedCaptionId ? { ...c, ...updates } : c));
  };

  const removeCaption = (id: string) => {
    setCaptions(captions.filter(c => c.id !== id));
    if (selectedCaptionId === id) {
        setSelectedCaptionId(null);
        setActiveTab('caption');
    }
  };

  const selectedCaption = captions.find(c => c.id === selectedCaptionId);

  // --- RENDER HELPERS ---
  const getCaptionStyle = (caption: MemeCaption) => {
      // Simulating the stroke using text-shadow for reliable preview that matches simple strokeText
      // For a true stroke effect in CSS, -webkit-text-stroke is best
      return {
        color: caption.color,
        fontSize: `${caption.fontSize}px`,
        WebkitTextStroke: `${caption.strokeWidth}px ${caption.strokeColor}`,
        // Fallback for no text-stroke support (optional, but good practice)
        textShadow: `
          ${caption.strokeWidth}px ${caption.strokeWidth}px 0 ${caption.strokeColor},
          -${caption.strokeWidth}px ${caption.strokeWidth}px 0 ${caption.strokeColor},
          ${caption.strokeWidth}px -${caption.strokeWidth}px 0 ${caption.strokeColor},
          -${caption.strokeWidth}px -${caption.strokeWidth}px 0 ${caption.strokeColor}
        `
      };
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-brand-500 selection:text-white overflow-hidden flex flex-col md:flex-row">
      
      {/* --- LEFT SIDEBAR: TOOLS --- */}
      <aside className="w-full md:w-80 bg-slate-800 border-r border-slate-700 flex flex-col overflow-y-auto h-1/3 md:h-screen shrink-0 z-20 shadow-xl">
        <div className="p-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-brand-400 to-purple-400 bg-clip-text text-transparent font-meme tracking-wide mb-2">
            MemeGenius AI
          </h1>
          <p className="text-slate-400 text-sm mb-6">Create viral content with Gemini</p>

          {/* Upload Section */}
          <div className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Source</h2>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleUpload}
              accept="image/*"
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 rounded-xl border border-slate-600 transition flex items-center justify-center gap-2 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              Upload Image
            </button>
          </div>

          {/* Templates Grid */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Trending Templates</h2>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map(t => (
                <button 
                  key={t.id} 
                  onClick={() => handleSelectTemplate(t.url)}
                  className="relative aspect-square rounded-lg overflow-hidden border border-slate-700 hover:border-brand-500 transition group"
                >
                  <img src={t.url} alt={t.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <span className="text-xs font-bold">Use This</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* --- CENTER: CANVAS AREA --- */}
      <main 
        className="flex-1 bg-slate-950 relative flex items-center justify-center p-4 md:p-12 overflow-hidden"
        onClick={() => setSelectedCaptionId(null)}
      >
        
        {currentImage && (
            <button 
              onClick={(e) => { e.stopPropagation(); handleDownload(); }}
              className="absolute top-6 right-6 z-40 bg-slate-800 hover:bg-brand-600 text-white p-3 rounded-full shadow-lg shadow-black/50 border border-slate-700 transition-all hover:scale-110 hover:rotate-3 group"
              title="Download Meme"
            >
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
               <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap">
                 Download
               </span>
            </button>
        )}

        {!currentImage ? (
          <div className="text-center text-slate-500">
            <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-800">
              <svg className="w-10 h-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <p className="text-lg">Select a template or upload an image to start</p>
          </div>
        ) : (
          <div className="relative max-w-full max-h-full shadow-2xl shadow-black/50 group">
            <img 
              ref={imageRef}
              src={`data:image/png;base64,${currentImage}`} 
              alt="Meme Canvas" 
              className="max-w-full max-h-[80vh] object-contain rounded-sm select-none"
            />
            
            {/* Overlaid Captions */}
            {captions.map(caption => (
              <div 
                key={caption.id}
                className={`absolute cursor-move p-2 rounded border-2 transition-colors ${selectedCaptionId === caption.id ? 'border-brand-500 bg-brand-500/10' : 'border-transparent hover:border-white/30'}`}
                style={{ 
                  left: `${caption.x}%`, 
                  top: `${caption.y}%`, 
                  transform: 'translate(-50%, -50%)',
                }}
                draggable
                onClick={(e) => { e.stopPropagation(); setSelectedCaptionId(caption.id); setActiveTab('style'); }}
                onDragEnd={(e) => {
                    if(imageRef.current) {
                        const rect = imageRef.current.getBoundingClientRect();
                        const x = ((e.clientX - rect.left) / rect.width) * 100;
                        const y = ((e.clientY - rect.top) / rect.height) * 100;
                        updateCaptionPosition(caption.id, Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
                        setSelectedCaptionId(caption.id);
                        setActiveTab('style');
                    }
                }}
              >
                <h2 
                  className="font-meme text-center uppercase leading-tight pointer-events-none whitespace-nowrap"
                  style={getCaptionStyle(caption)}
                >
                  {caption.text}
                </h2>
                {selectedCaptionId === caption.id && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeCaption(caption.id); }}
                      className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition shadow-md"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Status Overlay */}
        {status !== AppStatus.IDLE && status !== AppStatus.SUCCESS && (
             <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                <Spinner size="lg" className="mb-4" />
                <p className="text-xl font-semibold animate-pulse">
                    {status === AppStatus.ANALYZING && "Analyzing pixels..."}
                    {status === AppStatus.GENERATING_CAPTIONS && "Thinking of something funny..."}
                    {status === AppStatus.EDITING_IMAGE && "Working magic on the image..."}
                </p>
             </div>
        )}
      </main>

      {/* --- RIGHT SIDEBAR: AI WIZARDRY --- */}
      <aside className="w-full md:w-96 bg-slate-900 border-l border-slate-800 flex flex-col h-1/3 md:h-screen shrink-0 z-20">
        
        {/* Tabs */}
        <div className="flex border-b border-slate-800">
            <button 
                onClick={() => setActiveTab('caption')}
                className={`flex-1 py-4 text-sm font-semibold transition ${activeTab === 'caption' ? 'text-brand-400 border-b-2 border-brand-400 bg-slate-800/50' : 'text-slate-400 hover:text-white'}`}
            >
                Caption
            </button>
            <button 
                onClick={() => setActiveTab('style')}
                className={`flex-1 py-4 text-sm font-semibold transition ${activeTab === 'style' ? 'text-amber-400 border-b-2 border-amber-400 bg-slate-800/50' : 'text-slate-400 hover:text-white'}`}
            >
                Style
            </button>
            <button 
                onClick={() => setActiveTab('edit')}
                className={`flex-1 py-4 text-sm font-semibold transition ${activeTab === 'edit' ? 'text-purple-400 border-b-2 border-purple-400 bg-slate-800/50' : 'text-slate-400 hover:text-white'}`}
            >
                Edit
            </button>
            <button 
                onClick={() => setActiveTab('analyze')}
                className={`flex-1 py-4 text-sm font-semibold transition ${activeTab === 'analyze' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-slate-800/50' : 'text-slate-400 hover:text-white'}`}
            >
                Context
            </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
            {activeTab === 'caption' && (
                <div className="space-y-6">
                     <div className="bg-slate-800/50 p-4 rounded-xl border border-brand-500/20">
                        <h3 className="text-brand-400 font-bold mb-2 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Instant Humor
                        </h3>
                        <p className="text-slate-400 text-sm mb-4">Let AI analyze the image and suggest viral captions.</p>
                        <button 
                            onClick={handleMagicCaption}
                            disabled={!currentImage}
                            className="w-full py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition shadow-lg shadow-brand-500/20"
                        >
                            Generate Captions
                        </button>
                     </div>

                     {suggestedCaptions.length > 0 && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h4 className="text-xs font-bold uppercase text-slate-500">Suggestions</h4>
                            {suggestedCaptions.map((cap, idx) => (
                                <button 
                                    key={idx}
                                    onClick={() => addCaption(cap)}
                                    className="w-full text-left p-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 hover:border-brand-500/50 transition text-sm group"
                                >
                                    <span className="text-slate-300 group-hover:text-white">{cap}</span>
                                </button>
                            ))}
                        </div>
                     )}

                     {/* Manual Add */}
                     <div className="border-t border-slate-800 pt-6 mt-6">
                        <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Manual Caption</h4>
                        <form onSubmit={(e) => { e.preventDefault(); const form = e.target as HTMLFormElement; const input = form.elements.namedItem('caption') as HTMLInputElement; if(input.value) { addCaption(input.value); input.value = ''; } }}>
                            <div className="flex gap-2">
                                <input name="caption" type="text" placeholder="Type your own..." className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
                                <button type="submit" className="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg text-white">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                </button>
                            </div>
                        </form>
                     </div>
                </div>
            )}

            {activeTab === 'style' && (
                <div className="space-y-6">
                    {!selectedCaption ? (
                        <div className="text-center text-slate-500 py-10">
                            <svg className="w-12 h-12 mx-auto mb-2 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                            <p>Select a caption on the image to edit its style.</p>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Text Content</label>
                                <textarea 
                                    value={selectedCaption.text}
                                    onChange={(e) => updateSelectedCaption({ text: e.target.value })}
                                    className="w-full h-20 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-none font-meme uppercase text-lg"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between mb-1">
                                    <label className="text-xs font-bold uppercase text-slate-500">Font Size</label>
                                    <span className="text-xs text-slate-400">{Math.round(selectedCaption.fontSize)}px</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="10" 
                                    max="120" 
                                    value={selectedCaption.fontSize}
                                    onChange={(e) => updateSelectedCaption({ fontSize: Number(e.target.value) })}
                                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Fill Color</label>
                                    <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700">
                                        <input 
                                            type="color" 
                                            value={selectedCaption.color}
                                            onChange={(e) => updateSelectedCaption({ color: e.target.value })}
                                            className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                                        />
                                        <span className="text-xs text-slate-300 font-mono">{selectedCaption.color}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Stroke Color</label>
                                    <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700">
                                        <input 
                                            type="color" 
                                            value={selectedCaption.strokeColor}
                                            onChange={(e) => updateSelectedCaption({ strokeColor: e.target.value })}
                                            className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                                        />
                                        <span className="text-xs text-slate-300 font-mono">{selectedCaption.strokeColor}</span>
                                    </div>
                                </div>
                            </div>

                             <div>
                                <div className="flex justify-between mb-1">
                                    <label className="text-xs font-bold uppercase text-slate-500">Stroke Width</label>
                                    <span className="text-xs text-slate-400">{selectedCaption.strokeWidth}px</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="20" 
                                    step="0.5"
                                    value={selectedCaption.strokeWidth}
                                    onChange={(e) => updateSelectedCaption({ strokeWidth: Number(e.target.value) })}
                                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                />
                            </div>

                            <button 
                                onClick={() => removeCaption(selectedCaption.id)}
                                className="w-full mt-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50 rounded-lg text-sm font-semibold transition"
                            >
                                Delete Caption
                            </button>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'edit' && (
                <div className="space-y-6">
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-purple-500/20">
                        <h3 className="text-purple-400 font-bold mb-2 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            Magic Editor
                        </h3>
                        <p className="text-slate-400 text-sm mb-4">Describe changes you want to make to the image.</p>
                        <textarea 
                            value={editPrompt}
                            onChange={(e) => setEditPrompt(e.target.value)}
                            placeholder="E.g., 'Add a retro VHS filter', 'Make it night time', 'Remove background person'"
                            className="w-full h-24 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none mb-3 resize-none"
                        />
                        <button 
                            onClick={handleEditImage}
                            disabled={!currentImage || !editPrompt.trim()}
                            className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition shadow-lg shadow-purple-500/20"
                        >
                            Apply Edits
                        </button>
                    </div>
                    <div className="text-xs text-slate-500 p-2 bg-slate-900 rounded border border-slate-800">
                        <span className="font-bold text-purple-400">Note:</span> Powered by Gemini 2.5 Flash Image. This will regenerate the base image.
                    </div>
                </div>
            )}

            {activeTab === 'analyze' && (
                <div className="space-y-6">
                    {!analysis ? (
                        <div className="text-center py-10">
                            <button 
                                onClick={handleAnalyze}
                                disabled={!currentImage}
                                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-emerald-500/20 transition transform hover:scale-105"
                            >
                                Analyze Image Context
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in duration-500">
                             <div className="bg-emerald-900/20 p-4 rounded-xl border border-emerald-500/30">
                                <h4 className="text-emerald-400 font-bold mb-1 text-sm uppercase">Mood</h4>
                                <p className="text-emerald-100 text-lg font-medium">{analysis.mood}</p>
                             </div>

                             <div>
                                <h4 className="text-slate-500 font-bold mb-2 text-xs uppercase">Description</h4>
                                <p className="text-slate-300 text-sm leading-relaxed bg-slate-800 p-3 rounded-lg">
                                    {analysis.description}
                                </p>
                             </div>

                             <div>
                                <h4 className="text-slate-500 font-bold mb-2 text-xs uppercase">Keywords</h4>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.keywords.map((k, i) => (
                                        <span key={i} className="px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded-md border border-slate-700">#{k}</span>
                                    ))}
                                </div>
                             </div>

                             <button onClick={() => setAnalysis(null)} className="text-slate-500 text-xs underline hover:text-white w-full text-center pt-4">
                                Clear Analysis
                             </button>
                        </div>
                    )}
                </div>
            )}

        </div>
      </aside>
    </div>
  );
};

export default App;
