
import React, { useState } from 'react';
import { X, Sparkles, ChefHat, Loader2, Search, ArrowRight, Refrigerator } from 'lucide-react';
import { Recipe } from '../types';
import { suggestRecipes } from '../services/geminiService';
import BrandLogo from './BrandLogo';

interface RecommendationModalProps {
  recipes: Recipe[];
  inventory: string[];
  onClose: () => void;
  onSelectRecipes: (recipeIds: string[]) => void;
}

const RecommendationModal: React.FC<RecommendationModalProps> = ({ recipes, inventory, onClose, onSelectRecipes }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useInventory, setUseInventory] = useState(inventory.length > 0);

  const handleSurpriseMe = () => {
    // Basic logic: Pick 3 random highly rated or favorites
    const favorites = recipes.filter(r => r.isFavorite);
    const pool = favorites.length > 0 ? favorites : recipes;
    
    // Shuffle
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3).map(r => r.id);
    
    onSelectRecipes(selected);
    onClose();
  };

  const handleAiSearch = async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    try {
      const inventoryToUse = useInventory ? inventory : [];
      const ids = await suggestRecipes(recipes, query, inventoryToUse);
      if (ids.length > 0) {
        onSelectRecipes(ids);
        onClose();
      } else {
        alert("Mpishi couldn't find a good match in your cookbook. Try a different request!");
      }
    } catch (e) {
      console.error(e);
      alert("AI Service unavailable.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="bg-gradient-to-r from-chef-600 to-chef-500 p-6 text-white relative overflow-hidden">
           <Sparkles className="absolute top-2 right-2 w-24 h-24 text-white/10 rotate-12" />
           <div className="relative z-10">
             <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm border border-white/20">
               <BrandLogo className="text-white" />
             </div>
             <h2 className="text-2xl font-bold">Ask Mpishi</h2>
             <p className="text-chef-50 mt-1">What are you in the mood for today?</p>
           </div>
           <button 
             onClick={onClose}
             className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
           >
             <X className="w-5 h-5" />
           </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* AI Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tell Mpishi
            </label>
            <div className="relative">
              <input 
                type="text"
                placeholder="e.g. Something spicy with chicken, or a quick vegetarian lunch..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-4 pr-12 focus:ring-2 focus:ring-chef-500 focus:border-transparent outline-none transition-all"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAiSearch()}
                autoFocus
              />
              <button 
                onClick={handleAiSearch}
                disabled={isLoading || !query.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-chef-600 text-white rounded-lg hover:bg-chef-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Inventory Toggle */}
          {inventory.length > 0 && (
             <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-lg border border-blue-100">
                <div className={`p-2 rounded-full ${useInventory ? 'bg-blue-200 text-blue-700' : 'bg-gray-200 text-gray-400'}`}>
                   <Refrigerator className="w-5 h-5" />
                </div>
                <div className="flex-1">
                   <h4 className="text-sm font-bold text-gray-800">Check my Inventory</h4>
                   <p className="text-xs text-gray-500">Prioritize recipes with ingredients I have.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={useInventory} onChange={(e) => setUseInventory(e.target.checked)} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
             </div>
          )}

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-100"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-medium uppercase tracking-wider">Or try this</span>
            <div className="flex-grow border-t border-gray-100"></div>
          </div>

          {/* Quick Option */}
          <button 
            onClick={handleSurpriseMe}
            className="w-full py-4 border-2 border-dashed border-indigo-200 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-300 rounded-xl flex items-center justify-center gap-3 text-indigo-700 font-bold transition-all group"
          >
            <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            Surprise Me (Random Favorite)
          </button>
          
        </div>
      </div>
    </div>
  );
};

export default RecommendationModal;
