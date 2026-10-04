
import React from 'react';
import { Clock, Users, Heart, ArrowRight, ExternalLink } from 'lucide-react';
import { Recipe } from '../types';

interface RecipeCardProps {
  recipe: Recipe;
  onClick: (id: string) => void;
  onToggleFavorite: (e: React.MouseEvent, id: string) => void;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onClick, onToggleFavorite }) => {
  return (
    <div 
      onClick={() => onClick(recipe.id)}
      className="group bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden cursor-pointer flex flex-col h-full hover:-translate-y-1"
    >
      <div className="relative h-48 overflow-hidden bg-gray-100">
        <img 
          src={recipe.imageUrl} 
          alt={recipe.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <button
          onClick={(e) => onToggleFavorite(e, recipe.id)}
          className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-white transition-all"
        >
          <Heart 
            className={`w-5 h-5 ${recipe.isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} 
          />
        </button>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-12">
           <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {recipe.tags.slice(0, 3).map(tag => (
                <span key={tag} className="px-2 py-0.5 text-xs font-medium bg-white/20 text-white backdrop-blur-sm rounded-full whitespace-nowrap">
                  {tag}
                </span>
              ))}
           </div>
        </div>
      </div>
      
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="font-bold text-lg text-gray-800 mb-1 leading-tight group-hover:text-chef-600 transition-colors">
          {recipe.title}
        </h3>
        {recipe.authorName && (
          <p className="text-[11px] text-chef-700 font-medium mb-2">
            by {recipe.authorName}
          </p>
        )}
        
        <div className="flex items-center justify-between text-sm text-gray-500 mt-auto pt-4 border-t border-gray-50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{recipe.prepTime + recipe.cookTime}m</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{recipe.servings}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
             {recipe.sourceUrl && (
                <a 
                  href={recipe.sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-gray-400 hover:text-blue-500 transition-colors"
                  title="View Source"
                >
                    <ExternalLink className="w-4 h-4" />
                </a>
             )}
             <ArrowRight className="w-4 h-4 text-chef-400 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecipeCard;
