
import React, { useState, useRef } from 'react';
import { X, Loader2, Sparkles, FileText, Image as ImageIcon, UploadCloud, Info, ChefHat } from 'lucide-react';
import { parseRecipe } from '../services/geminiService';
import { Recipe, NewRecipeInput } from '../types';
import { v4 as uuidv4 } from 'uuid';
import BrandLogo from './BrandLogo';

interface ImportModalProps {
  onClose: () => void;
  onSave: (recipe: Recipe) => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ onClose, onSave }) => {
  const [activeTab, setActiveTab] = useState<'TEXT' | 'IMAGE'>('TEXT');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Image Upload State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    if (activeTab === 'TEXT' && !input.trim()) return;
    if (activeTab === 'IMAGE' && !selectedImage && !input.trim()) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Pass image if on Image Tab
      const imageToProcess = activeTab === 'IMAGE' ? selectedImage || undefined : undefined;
      const parsedData: NewRecipeInput = await parseRecipe(input, imageToProcess);
      
      const newRecipe: Recipe = {
        ...parsedData,
        id: uuidv4(),
        rating: 0,
        isFavorite: false,
        createdAt: new Date().toISOString()
      };
      
      onSave(newRecipe);
      onClose();
    } catch (err) {
      console.error(err);
      setError("Failed to parse recipe. Please ensure the API key is valid and the input is clear.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setSelectedImage(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-chef-50">
          <div className="flex items-center gap-2">
            <div className="bg-white p-1 rounded-lg border border-chef-100">
              <BrandLogo />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Smart Import</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
            <button 
                onClick={() => setActiveTab('TEXT')}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'TEXT' ? 'border-chef-600 text-chef-700 bg-gray-50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
            >
                <FileText className="w-4 h-4" /> Paste Text / Link
            </button>
            <button 
                onClick={() => setActiveTab('IMAGE')}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'IMAGE' ? 'border-chef-600 text-chef-700 bg-gray-50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
            >
                <ImageIcon className="w-4 h-4" /> Scan Photo
            </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          
          {activeTab === 'TEXT' ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                   {/* Pro Tip for URLs */}
                   <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800 flex items-start gap-3">
                        <Info className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
                        <div>
                            <span className="font-bold block mb-1">Importing from a website?</span>
                            <p className="opacity-90 leading-relaxed">
                                For best results, go to the website, press <kbd className="bg-white px-1 rounded border border-blue-200 font-mono">Ctrl+A</kbd> (Select All), <kbd className="bg-white px-1 rounded border border-blue-200 font-mono">Ctrl+C</kbd> (Copy), and then Paste here. 
                                <br/><span className="text-xs mt-1 inline-block opacity-75">Browser security prevents us from reading URLs directly, but copying the text works perfectly!</span>
                            </p>
                        </div>
                   </div>

                  <label className="block text-sm font-medium text-gray-700">
                    Paste Recipe Text
                  </label>
                  <textarea
                    className="w-full h-48 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-chef-500 focus:border-transparent resize-none bg-gray-50 text-gray-800 placeholder-gray-400 font-mono text-sm"
                    placeholder="Paste the full recipe text here..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
              </div>
          ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl h-64 flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden group
                        ${selectedImage ? 'border-chef-400 bg-chef-50' : 'border-gray-300 hover:border-chef-400 hover:bg-gray-50'}`}
                  >
                      {selectedImage ? (
                          <img src={selectedImage} alt="Preview" className="w-full h-full object-contain" />
                      ) : (
                          <>
                            <UploadCloud className="w-12 h-12 text-gray-300 group-hover:text-chef-500 mb-3 transition-colors" />
                            <p className="text-gray-500 font-medium">Click to upload or drag image here</p>
                            <p className="text-xs text-gray-400 mt-1">Supports JPG, PNG, WEBP</p>
                          </>
                      )}
                      
                      {selectedImage && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-white font-bold">Click to Change</span>
                          </div>
                      )}
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                  
                  <div className="space-y-2">
                       <label className="text-sm font-medium text-gray-700">Optional Context / Notes</label>
                       <input 
                         type="text" 
                         className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-chef-500 outline-none"
                         placeholder="e.g. This is Grandma's Apple Pie, it serves 8..."
                         value={input}
                         onChange={(e) => setInput(e.target.value)}
                       />
                  </div>
              </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-start gap-2">
              <span className="text-lg">⚠️</span>
              {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isLoading || (activeTab === 'TEXT' && !input.trim()) || (activeTab === 'IMAGE' && !selectedImage)}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-white shadow-lg shadow-chef-200 transition-all
              ${isLoading || (activeTab === 'TEXT' && !input.trim()) || (activeTab === 'IMAGE' && !selectedImage)
                ? 'bg-gray-400 cursor-not-allowed shadow-none' 
                : 'bg-chef-600 hover:bg-chef-700 hover:scale-[1.02]'}`}
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChefHat className="w-5 h-5" />}
            {isLoading ? 'Processing...' : activeTab === 'IMAGE' ? 'Scan & Import' : 'Parse Text'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
