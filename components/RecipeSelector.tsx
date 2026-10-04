
import React, { useState } from 'react';
import { X, Search, PlusCircle } from 'lucide-react';
import { Recipe } from '../types';

interface RecipeSelectorProps {
  recipes: Recipe[];
  onSelect: (recipeId: string) => void;
  onClose: () => void;
}

const RecipeSelector: React.FC<RecipeSelectorProps> = ({ recipes, onSelect, onClose }) => {
  const [search, setSearch] = useState('');

  const filtered = recipes.filter(r => 
    r.title.toLowerCase().includes(search.toLowerCase()) || 
    r.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const handleCustomSelect = () => {
    if (search.trim()) {
      onSelect(search.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800">Select Recipe</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              className="w-full bg-gray-100 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-chef-500"
              placeholder="Search or type custom meal..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCustomSelect();
              }}
              autoFocus
            />
          </div>
          
          {search.trim() && (
             <button
                onClick={handleCustomSelect}
                className="w-full py-2.5 bg-indigo-50 text-indigo-700 font-medium rounded-lg hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 group"
             >
                <PlusCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Quick Add <strong>"{search}"</strong></span>
             </button>
          )}
        </div>

        <div className="overflow-y-auto flex-1 p-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              <p>No recipes found matching "{search}".</p>
              {search.trim() && <p className="mt-1">Use Quick Add above to create a custom plan.</p>}
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map(recipe => (
                <button
                  key={recipe.id}
                  onClick={() => onSelect(recipe.id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-chef-50 rounded-lg transition-colors text-left group"
                >
                  <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-200 flex-shrink-0">
                    <img src={recipe.imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-800 group-hover:text-chef-700">{recipe.title}</div>
                    <div className="text-xs text-gray-500 truncate max-w-[200px]">
                      {recipe.tags.slice(0, 2).join(', ')}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecipeSelector;
