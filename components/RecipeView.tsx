
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Clock, Users, Flame, Check, 
  PlayCircle, Heart, Trash2, Wand2, Loader2,
  Utensils, ListOrdered, Plus, X, Tag, CalendarCheck, Pencil, Refrigerator, Minus, Globe, ExternalLink, Save, Type, GripVertical, Edit
} from 'lucide-react';
import { Recipe, Ingredient } from '../types';
import { modifyRecipeWithAI } from '../services/geminiService';
import { v4 as uuidv4 } from 'uuid';
import RecipeEditorModal from './RecipeEditorModal';

interface RecipeViewProps {
  recipe: Recipe;
  onBack: () => void;
  onUpdate: (updated: Recipe) => void;
  onSaveCopy: (recipe: Recipe) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  inventory: string[];
  onUpdateInventory: (items: string[]) => void;
}

const RecipeView: React.FC<RecipeViewProps> = ({ recipe, onBack, onUpdate, onSaveCopy, onDelete, onToggleFavorite, inventory, onUpdateInventory }) => {
  const [activeTab, setActiveTab] = useState<'ingredients' | 'instructions'>('ingredients');
  const [cookMode, setCookMode] = useState(false);
  const [cookViewMode, setCookViewMode] = useState<'ingredients' | 'steps'>('steps');
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isModifying, setIsModifying] = useState(false);
  const [modifyPrompt, setModifyPrompt] = useState('');
  const [showModifyInput, setShowModifyInput] = useState(false);
  
  // Tag editing state
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState('');

  // Main Editor State
  const [showFullEditor, setShowFullEditor] = useState(false);

  // Ingredient Editing State
  const [showIngredientEditor, setShowIngredientEditor] = useState(false);
  const [tempIngredients, setTempIngredients] = useState<Ingredient[]>([]);
  const [draggedIngredientIndex, setDraggedIngredientIndex] = useState<number | null>(null);

  // Scaling State
  const [currentServings, setCurrentServings] = useState(recipe.servings);

  // Inventory usage state
  const [showUsedIngredientsModal, setShowUsedIngredientsModal] = useState(false);
  const [matchingInventoryItems, setMatchingInventoryItems] = useState<string[]>([]);
  const [itemsToRemove, setItemsToRemove] = useState<Set<string>>(new Set());

  // Wake Lock for Cook Mode
  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          console.log('Wake Lock active');
        }
      } catch (err) {
        console.warn('Wake Lock not supported or failed', err);
      }
    };

    if (cookMode) {
      requestWakeLock();
    } else {
        setCookViewMode('steps');
    }

    return () => {
      if (wakeLock) wakeLock.release();
    };
  }, [cookMode]);

  const toggleStep = (index: number) => {
    setCompletedSteps(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  // Update scaling when recipe changes
  useEffect(() => {
    setCurrentServings(recipe.servings);
  }, [recipe.id, recipe.servings]);

  const handleModify = async () => {
    if (!modifyPrompt.trim()) return;
    setIsModifying(true);
    try {
      const updatedData = await modifyRecipeWithAI(recipe, modifyPrompt);
      
      const newRecipe: Recipe = {
        ...recipe,
        ...updatedData,
        id: uuidv4(),
        title: updatedData.title !== recipe.title ? updatedData.title : `${recipe.title} (Modified)`,
        isFavorite: false,
        rating: 0,
        lastCooked: undefined,
        createdAt: new Date().toISOString()
      };

      onSaveCopy(newRecipe);
      setShowModifyInput(false);
      setModifyPrompt('');
    } catch (e) {
      console.error(e);
      alert('Failed to modify recipe. Try again.');
    } finally {
      setIsModifying(false);
    }
  };

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !recipe.tags.includes(trimmed)) {
      const updatedTags = [...recipe.tags, trimmed];
      onUpdate({ ...recipe, tags: updatedTags });
    }
    setNewTag('');
    setShowTagInput(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = recipe.tags.filter(t => t !== tagToRemove);
    onUpdate({ ...recipe, tags: updatedTags });
  };

  // Ingredient Editor Handlers
  const openIngredientEditor = () => {
    setTempIngredients(JSON.parse(JSON.stringify(recipe.ingredients)));
    setShowIngredientEditor(true);
    setDraggedIngredientIndex(null);
  };

  const saveIngredients = () => {
    onUpdate({ ...recipe, ingredients: tempIngredients });
    setShowIngredientEditor(false);
  };

  const updateTempIngredient = (index: number, field: keyof Ingredient, value: any) => {
    const updated = [...tempIngredients];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-update originalString for context
    const { amount, unit, item } = updated[index];
    if (amount === 0 && (!unit || unit === '')) {
       updated[index].originalString = item; // Header style
    } else {
       updated[index].originalString = `${amount} ${unit} ${item}`;
    }
    
    setTempIngredients(updated);
  };

  const addTempIngredient = () => {
    setTempIngredients([...tempIngredients, { item: '', amount: 1, unit: 'unit', originalString: '' }]);
  };

  const addTempHeader = () => {
    setTempIngredients([...tempIngredients, { item: 'New Section', amount: 0, unit: '', originalString: 'New Section' }]);
  };

  const removeTempIngredient = (index: number) => {
    const updated = tempIngredients.filter((_, i) => i !== index);
    setTempIngredients(updated);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    // Prevent drag if touching inputs to allow text selection
    if ((e.target as HTMLElement).tagName === 'INPUT') {
        e.preventDefault();
        return;
    }
    setDraggedIngredientIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault(); // Necessary for drop to work
    if (draggedIngredientIndex === null || draggedIngredientIndex === index) return;
    
    // Live Swap
    const newItems = [...tempIngredients];
    const [draggedItem] = newItems.splice(draggedIngredientIndex, 1);
    newItems.splice(index, 0, draggedItem);
    
    setTempIngredients(newItems);
    setDraggedIngredientIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIngredientIndex(null);
  };

  const executeMarkCooked = () => {
      const today = new Date().toISOString();
      onUpdate({ ...recipe, lastCooked: today });
  };

  const handleAttemptMarkCooked = () => {
    const matches: string[] = [];
    inventory.forEach(invItem => {
        const normalize = (s: string) => s.toLowerCase().trim();
        const normalizedInv = normalize(invItem);
        const isMatch = recipe.ingredients.some(rIng => {
            const normalizedRecipeIng = normalize(rIng.item);
            return normalizedRecipeIng.includes(normalizedInv) || normalizedInv.includes(normalizedRecipeIng);
        });
        if (isMatch) matches.push(invItem);
    });

    if (matches.length > 0) {
        setMatchingInventoryItems(matches);
        setShowUsedIngredientsModal(true);
        setItemsToRemove(new Set());
    } else {
        executeMarkCooked();
        setCookMode(false);
    }
  };

  const handleConfirmUsedIngredients = () => {
      if (itemsToRemove.size > 0) {
          const newInventory = inventory.filter(item => !itemsToRemove.has(item));
          onUpdateInventory(newInventory);
      }
      executeMarkCooked();
      setShowUsedIngredientsModal(false);
      setCookMode(false);
  };

  const toggleItemToRemove = (item: string) => {
      const newSet = new Set(itemsToRemove);
      if (newSet.has(item)) newSet.delete(item);
      else newSet.add(item);
      setItemsToRemove(newSet);
  };

  const checkInventory = (ingredientName: string) => {
    const normalize = (s: string) => s.toLowerCase().trim();
    const target = normalize(ingredientName);
    return inventory.some(item => {
      const inv = normalize(item);
      return target.includes(inv) || inv.includes(target);
    });
  };

  const handleToggleInventory = (item: string) => {
    if (checkInventory(item)) {
        const normalize = (s: string) => s.toLowerCase().trim();
        const target = normalize(item);
        const newInventory = inventory.filter(invItem => {
            const inv = normalize(invItem);
            return !(target.includes(inv) || inv.includes(target));
        });
        onUpdateInventory(newInventory);
    } else {
        const formatted = item.charAt(0).toUpperCase() + item.slice(1);
        onUpdateInventory([...inventory, formatted]);
    }
  };

  const handleScale = (delta: number) => {
    setCurrentServings(prev => Math.max(1, prev + delta));
  };

  const getScaledAmount = (amount: number) => {
      if (currentServings === recipe.servings) return amount;
      const ratio = currentServings / recipe.servings;
      const scaled = amount * ratio;
      return Math.round(scaled * 100) / 100; // Round to 2 decimals
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  // Helper to identify a section header (Amount 0, No Unit)
  const isSectionHeader = (ing: Ingredient) => {
      return ing.amount === 0 && (!ing.unit || ing.unit === 'unit' || ing.unit.trim() === '');
  };

  // --------------------------------------------------------------------------------
  // COOK MODE RENDER
  // --------------------------------------------------------------------------------
  if (cookMode) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        <div className="p-4 bg-chef-600 text-white flex justify-between items-center shadow-md z-10 shrink-0">
          <h2 className="font-bold text-lg truncate pr-4">{recipe.title}</h2>
          <button 
            onClick={() => setCookMode(false)}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
          >
            Exit Cook Mode
          </button>
        </div>

        <div className="flex bg-white border-b border-gray-200 z-10 shadow-sm shrink-0">
           <button 
             onClick={() => setCookViewMode('ingredients')}
             className={`flex-1 py-4 flex items-center justify-center gap-2 font-bold text-lg transition-colors ${cookViewMode === 'ingredients' ? 'text-chef-600 border-b-4 border-chef-600 bg-chef-50' : 'text-gray-500 hover:bg-gray-50'}`}
           >
             <Utensils className="w-5 h-5" />
             Ingredients
           </button>
           <button 
             onClick={() => setCookViewMode('steps')}
             className={`flex-1 py-4 flex items-center justify-center gap-2 font-bold text-lg transition-colors ${cookViewMode === 'steps' ? 'text-chef-600 border-b-4 border-chef-600 bg-chef-50' : 'text-gray-500 hover:bg-gray-50'}`}
           >
             <ListOrdered className="w-5 h-5" />
             Steps
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full bg-gray-50/50">
           {cookViewMode === 'ingredients' ? (
             <div className="space-y-4 animate-in fade-in duration-300">
               {/* Scaler in Cook Mode */}
               <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between mb-4">
                  <span className="font-bold text-gray-700">Scaling for:</span>
                  <div className="flex items-center gap-3">
                     <button onClick={() => handleScale(-1)} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600"><Minus className="w-4 h-4"/></button>
                     <span className="text-xl font-bold w-6 text-center">{currentServings}</span>
                     <button onClick={() => handleScale(1)} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600"><Plus className="w-4 h-4"/></button>
                  </div>
               </div>

               {recipe.ingredients.map((ing, i) => {
                  if (isSectionHeader(ing)) {
                       return (
                           <div key={i} className="col-span-full pt-6 pb-2">
                               <h3 className="text-xl font-bold text-chef-800 border-b-2 border-chef-200 pb-1 inline-block">{ing.item}</h3>
                           </div>
                       );
                  }

                  const inStock = checkInventory(ing.item);
                  return (
                    <div 
                        key={i} 
                        onClick={() => handleToggleInventory(ing.item)}
                        className="flex items-center p-6 bg-white rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:border-chef-300 transition-all group/item"
                    >
                      <div className="w-4 h-4 rounded-full bg-chef-400 mr-6 shrink-0" />
                      <div className="flex-1">
                        <span className="text-2xl text-gray-800 leading-snug select-none">
                          <span className="font-bold text-chef-700">{getScaledAmount(ing.amount)} {ing.unit}</span> {ing.item}
                          {inStock ? (
                            <span 
                                className="ml-3 inline-block w-4 h-4 bg-green-500 rounded-full shadow-sm align-middle ring-2 ring-green-100 group-hover/item:scale-110 transition-transform" 
                                title="In Inventory (Click to remove)"
                            />
                          ) : (
                            <span 
                                className="ml-3 inline-block w-4 h-4 border-2 border-gray-200 bg-gray-50 rounded-full align-middle group-hover/item:bg-green-100 group-hover/item:border-green-300 transition-colors" 
                                title="Not in Inventory (Click to add)"
                            />
                          )}
                        </span>
                        {ing.originalString && (
                            <span className="block text-lg text-gray-400 font-normal mt-1">
                                {ing.originalString}
                                {currentServings !== recipe.servings && <span className="text-chef-500 text-sm ml-2">(Original)</span>}
                            </span>
                        )}
                      </div>
                    </div>
                  );
               })}
             </div>
           ) : (
             <div className="space-y-6 animate-in fade-in duration-300">
               {recipe.instructions.map((step, idx) => (
                 <div 
                   key={idx} 
                   onClick={() => toggleStep(idx)}
                   className={`p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200
                     ${completedSteps.includes(idx) 
                       ? 'bg-chef-50 border-chef-200 opacity-60' 
                       : 'bg-white border-gray-200 hover:border-chef-400 shadow-sm'}`}
                 >
                   <div className="flex gap-5">
                     <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl transition-colors
                       ${completedSteps.includes(idx) ? 'bg-chef-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                       {completedSteps.includes(idx) ? <Check className="w-7 h-7" /> : idx + 1}
                     </div>
                     <p className={`text-2xl leading-relaxed pt-1 ${completedSteps.includes(idx) ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                       {step}
                     </p>
                   </div>
                 </div>
               ))}
               <div className="p-8 text-center">
                 <button 
                    onClick={handleAttemptMarkCooked}
                    className="px-6 py-3 bg-chef-600 text-white rounded-xl font-bold shadow-lg hover:bg-chef-700 transition-all transform hover:scale-105"
                 >
                    Finish & Mark as Cooked
                 </button>
               </div>
             </div>
           )}
           <div className="h-20" />
        </div>
        
        {/* Modal Logic Reuse */}
        {showUsedIngredientsModal && (
             <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
                    <div className="p-6">
                        <div className="flex items-start gap-4 mb-4">
                             <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                                <Refrigerator className="w-6 h-6 text-amber-600" />
                             </div>
                             <div>
                                 <h3 className="text-xl font-bold text-gray-800">Did you use it up?</h3>
                                 <p className="text-gray-500 text-sm mt-1">
                                     We found these items in your inventory. Select any that you <strong>ran out of</strong> while cooking.
                                 </p>
                             </div>
                        </div>

                        <div className="max-h-60 overflow-y-auto mb-6 bg-gray-50 rounded-lg border border-gray-200 p-2 space-y-1">
                             {matchingInventoryItems.map(item => {
                                 const isSelected = itemsToRemove.has(item);
                                 return (
                                     <button 
                                       key={item}
                                       onClick={() => toggleItemToRemove(item)}
                                       className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${isSelected ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100 hover:border-chef-200'}`}
                                     >
                                         <span className={`font-medium ${isSelected ? 'text-red-700' : 'text-gray-700'}`}>{item}</span>
                                         {isSelected ? (
                                             <div className="flex items-center gap-1 text-xs font-bold text-red-600 bg-white px-2 py-0.5 rounded-full border border-red-100">
                                                <Trash2 className="w-3 h-3" /> Remove
                                             </div>
                                         ) : (
                                             <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                                         )}
                                     </button>
                                 );
                             })}
                        </div>

                        <div className="flex gap-3">
                             <button 
                                onClick={handleConfirmUsedIngredients}
                                className="flex-1 py-3 bg-chef-600 text-white font-bold rounded-lg hover:bg-chef-700 transition-colors shadow-lg shadow-chef-100"
                             >
                                 {itemsToRemove.size > 0 ? `Remove ${itemsToRemove.size} Items & Finish` : 'Keep Inventory & Finish'}
                             </button>
                        </div>
                    </div>
                </div>
             </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------------
  // STANDARD VIEW RENDER
  // --------------------------------------------------------------------------------
  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 hover:text-chef-600 font-medium transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            {recipe.sourceUrl && (
                <a 
                  href={recipe.sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors"
                >
                    <Globe className="w-4 h-4" />
                    Source
                    <ExternalLink className="w-3 h-3" />
                </a>
            )}
        </div>
        <div className="flex gap-2">
          <button 
             onClick={() => setShowFullEditor(true)}
             className="px-3 py-2 bg-chef-50 text-chef-700 hover:bg-chef-100 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors border border-chef-100"
             title="Edit Recipe Details"
           >
            <Edit className="w-4 h-4" /> Edit Recipe
          </button>

          <button 
             onClick={() => onToggleFavorite(recipe.id)}
             className={`p-2 rounded-full border transition-colors ${recipe.isFavorite ? 'bg-red-50 border-red-200 text-red-500' : 'bg-white border-gray-200 text-gray-400 hover:text-red-500'}`}
           >
            <Heart className={`w-5 h-5 ${recipe.isFavorite ? 'fill-current' : ''}`} />
          </button>
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(recipe.id);
            }}
            className="p-2 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Delete Recipe"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-8 group/hero">
        <div className="relative h-64 md:h-80">
          <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          
          <div className="absolute bottom-0 left-0 p-8 text-white w-full">
            <h1 className="text-3xl md:text-4xl font-bold mb-1">{recipe.title}</h1>
            {recipe.authorName && (
              <p className="text-xs text-chef-200 font-semibold mb-3">
                Cookbook Entry by {recipe.authorName}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-4 text-sm font-medium">
                <div className="flex items-center gap-1 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full">
                  <Clock className="w-4 h-4" />
                  {recipe.prepTime + recipe.cookTime} mins
                </div>
                
                {/* Instant Scaler */}
                <div className="flex items-center gap-1 bg-white/20 backdrop-blur-md pl-3 pr-1 py-0.5 rounded-full">
                  <Users className="w-4 h-4 mr-1" />
                  <span className="mr-1">{currentServings} servings</span>
                  <div className="flex gap-1 ml-1">
                      <button onClick={() => handleScale(-1)} className="w-6 h-6 flex items-center justify-center bg-white/20 hover:bg-white/40 rounded-full text-xs font-bold transition-colors">-</button>
                      <button onClick={() => handleScale(1)} className="w-6 h-6 flex items-center justify-center bg-white/20 hover:bg-white/40 rounded-full text-xs font-bold transition-colors">+</button>
                  </div>
                </div>

                {recipe.calories && (
                  <div className="flex items-center gap-1 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full">
                    <Flame className="w-4 h-4" />
                    {recipe.calories} kcal
                  </div>
                )}
              </div>
              {recipe.lastCooked && (
                <div className="flex items-center gap-1 text-xs font-medium text-white/80 bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm">
                  <CalendarCheck className="w-3 h-3" />
                  Last cooked: {formatDate(recipe.lastCooked)}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8">
          <p className="text-gray-600 leading-relaxed mb-6">{recipe.description}</p>
          
          <div className="flex flex-wrap items-center gap-2 mb-8">
             <div className="flex items-center gap-2 text-gray-400 mr-2">
                <Tag className="w-4 h-4" />
                <span className="text-sm font-medium">Tags:</span>
             </div>
             {recipe.tags.map(tag => (
                <span key={tag} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-sm transition-colors flex items-center gap-1.5 group cursor-default">
                   {tag}
                   <button 
                     onClick={() => handleRemoveTag(tag)}
                     className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                     title="Remove tag"
                   >
                     <X className="w-3 h-3" />
                   </button>
                </span>
             ))}
             
             {showTagInput ? (
                <div className="flex items-center gap-2 animate-in fade-in duration-200">
                   <input
                     type="text"
                     value={newTag}
                     onChange={(e) => setNewTag(e.target.value)}
                     onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddTag();
                        if (e.key === 'Escape') setShowTagInput(false);
                     }}
                     className="px-3 py-1 border border-chef-300 rounded-full text-sm outline-none focus:ring-2 focus:ring-chef-200 w-32 bg-white"
                     autoFocus
                     placeholder="New tag..."
                   />
                   <button onClick={handleAddTag} className="p-1 hover:bg-green-100 rounded-full text-green-600 transition-colors"><Check className="w-4 h-4" /></button>
                   <button onClick={() => setShowTagInput(false)} className="p-1 hover:bg-red-100 rounded-full text-red-600 transition-colors"><X className="w-4 h-4" /></button>
                </div>
             ) : (
                <button 
                  onClick={() => setShowTagInput(true)}
                  className="px-3 py-1 border border-dashed border-gray-300 text-gray-400 hover:text-chef-600 hover:border-chef-400 rounded-full text-sm flex items-center gap-1 transition-all hover:bg-chef-50"
                >
                  <Plus className="w-3 h-3" /> Add Tag
                </button>
             )}
          </div>

          <div className="flex flex-col md:flex-row flex-wrap gap-3 mb-8 pb-8 border-b border-gray-100">
             <button 
               onClick={() => setCookMode(true)}
               className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-chef-600 text-white rounded-xl font-bold hover:bg-chef-700 transition-all shadow-lg shadow-chef-200"
             >
               <PlayCircle className="w-5 h-5" />
               Start Cooking
             </button>

             <button 
                onClick={handleAttemptMarkCooked}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
             >
                <CalendarCheck className="w-5 h-5" />
                <span className="hidden md:inline">Mark Cooked</span>
                <span className="md:hidden">Cooked</span>
             </button>

             <div className="flex-1 md:flex-none flex gap-2 relative">
                {!showModifyInput ? (
                     <button 
                       onClick={() => setShowModifyInput(true)}
                       className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl font-medium hover:bg-indigo-100 transition-colors"
                     >
                       <Wand2 className="w-5 h-5" />
                       Modify with AI
                     </button>
                ) : (
                    <div className="flex items-center gap-2 w-full animate-in fade-in slide-in-from-left-4 duration-300">
                        <input 
                            type="text" 
                            autoFocus
                            placeholder="e.g. Make it spicy, Low Carb..."
                            className="border border-indigo-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm w-full md:w-64"
                            value={modifyPrompt}
                            onChange={(e) => setModifyPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleModify()}
                        />
                        <button 
                            onClick={handleModify}
                            disabled={isModifying}
                            className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 shrink-0"
                        >
                            {isModifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                        </button>
                         <button 
                            onClick={() => setShowModifyInput(false)}
                            className="text-gray-400 hover:text-gray-600 shrink-0"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    </div>
                )}
             </div>
          </div>

          <div className="flex gap-8 border-b border-gray-100 mb-6">
            <div className="flex items-center gap-2">
                <button 
                  onClick={() => setActiveTab('ingredients')}
                  className={`pb-4 font-bold text-lg transition-colors relative ${activeTab === 'ingredients' ? 'text-chef-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Ingredients
                  {activeTab === 'ingredients' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-chef-500 rounded-t-full" />}
                </button>
                {activeTab === 'ingredients' && (
                    <button 
                        onClick={openIngredientEditor}
                        className="p-1.5 mb-3 text-gray-400 hover:text-chef-600 hover:bg-chef-50 rounded-full transition-colors"
                        title="Edit Ingredients"
                    >
                        <Pencil className="w-4 h-4" />
                    </button>
                )}
            </div>
            
            <button 
              onClick={() => setActiveTab('instructions')}
              className={`pb-4 font-bold text-lg transition-colors relative ${activeTab === 'instructions' ? 'text-chef-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Instructions
              {activeTab === 'instructions' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-chef-500 rounded-t-full" />}
            </button>
          </div>

          <div className="min-h-[300px]">
            {activeTab === 'ingredients' ? (
              <ul className="grid md:grid-cols-2 gap-4">
                {recipe.ingredients.map((ing, i) => {
                  if (isSectionHeader(ing)) {
                       return (
                           <li key={i} className="md:col-span-2 mt-4 first:mt-0 mb-2">
                               <h4 className="font-bold text-lg text-chef-700 border-b border-chef-100 pb-1">{ing.item}</h4>
                           </li>
                       );
                  }
                  const inStock = checkInventory(ing.item);
                  return (
                    <li 
                        key={i} 
                        onClick={() => handleToggleInventory(ing.item)} 
                        className="flex items-start p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 cursor-pointer group/ing"
                    >
                      <div className="w-2 h-2 rounded-full bg-chef-400 mt-2 mr-3" />
                      <div>
                        <span className="font-bold text-gray-800 select-none">
                            {getScaledAmount(ing.amount)} {ing.unit}
                        </span>
                        <span className="text-gray-600 ml-1 select-none">{ing.item}</span>
                        {inStock ? (
                            <span 
                                className="ml-2 inline-block w-3 h-3 bg-green-500 rounded-full shadow-sm align-middle ring-2 ring-green-100 group-hover/ing:scale-125 transition-transform" 
                                title="In Inventory"
                            />
                        ) : (
                           <span 
                                className="ml-2 inline-block w-3 h-3 bg-gray-50 border border-gray-300 rounded-full align-middle group-hover/ing:border-green-400 group-hover/ing:bg-green-50 transition-colors" 
                                title="Not in Inventory"
                            />
                        )}
                        {/* Show original if scaled */}
                        {currentServings !== recipe.servings && (
                           <div className="text-[10px] text-chef-600 font-medium">
                               Orig: {ing.amount} {ing.unit}
                           </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ol className="space-y-6">
                {recipe.instructions.map((step, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-chef-100 text-chef-700 flex items-center justify-center font-bold text-sm">
                      {i + 1}
                    </span>
                    <p className="text-gray-700 leading-relaxed pt-1">{step}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>

      {/* Full Recipe Editor Modal */}
      {showFullEditor && (
        <RecipeEditorModal 
          recipe={recipe} 
          onSave={onUpdate} 
          onClose={() => setShowFullEditor(false)} 
        />
      )}

      {/* Ingredient Editor Modal */}
      {showIngredientEditor && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95">
                 <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 rounded-t-xl">
                     <h3 className="font-bold text-gray-800 flex items-center gap-2">
                         <Utensils className="w-5 h-5 text-chef-600" />
                         Edit Ingredients
                     </h3>
                     <button onClick={() => setShowIngredientEditor(false)} className="text-gray-400 hover:text-gray-600">
                         <X className="w-5 h-5" />
                     </button>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto p-4 space-y-2">
                     {tempIngredients.map((ing, idx) => {
                         const isHeader = isSectionHeader(ing);
                         return (
                             <div 
                                key={idx} 
                                draggable
                                onDragStart={(e) => handleDragStart(e, idx)}
                                onDragOver={(e) => handleDragOver(e, idx)}
                                onDragEnd={handleDragEnd}
                                className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                                    isHeader ? 'bg-chef-50 border-chef-100' : 'bg-white border-gray-200'
                                } ${draggedIngredientIndex === idx ? 'opacity-40 border-dashed border-chef-400' : ''}`}
                             >
                                 {/* Handle or Index */}
                                 <div className="text-gray-300 cursor-move px-1 active:text-chef-600"><GripVertical className="w-4 h-4" /></div>

                                 {/* Inputs */}
                                 {isHeader ? (
                                    <div className="flex-1 flex items-center gap-2">
                                        <Type className="w-4 h-4 text-chef-600" />
                                        <input 
                                            type="text" 
                                            className="flex-1 font-bold text-chef-800 bg-transparent outline-none placeholder-chef-300"
                                            value={ing.item}
                                            onChange={(e) => updateTempIngredient(idx, 'item', e.target.value)}
                                            placeholder="Section Name (e.g. Brine)"
                                        />
                                    </div>
                                 ) : (
                                    <>
                                        <input 
                                            type="number"
                                            step="any"
                                            className="w-16 p-1 border border-gray-300 rounded text-center text-sm outline-none focus:border-chef-500"
                                            value={ing.amount}
                                            onChange={(e) => updateTempIngredient(idx, 'amount', parseFloat(e.target.value) || 0)}
                                            placeholder="#"
                                        />
                                        <input 
                                            type="text"
                                            className="w-20 p-1 border border-gray-300 rounded text-center text-sm outline-none focus:border-chef-500"
                                            value={ing.unit}
                                            onChange={(e) => updateTempIngredient(idx, 'unit', e.target.value)}
                                            placeholder="Unit"
                                        />
                                        <input 
                                            type="text"
                                            className="flex-1 p-1 border border-gray-300 rounded text-sm outline-none focus:border-chef-500"
                                            value={ing.item}
                                            onChange={(e) => updateTempIngredient(idx, 'item', e.target.value)}
                                            placeholder="Ingredient Name"
                                        />
                                    </>
                                 )}

                                 <button 
                                    onClick={() => removeTempIngredient(idx)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                 >
                                     <Trash2 className="w-4 h-4" />
                                 </button>
                             </div>
                         );
                     })}
                     
                     <div className="pt-4 flex gap-2">
                         <button 
                            onClick={addTempIngredient}
                            className="flex-1 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-medium hover:border-chef-400 hover:text-chef-600 hover:bg-chef-50 transition-colors flex items-center justify-center gap-2"
                         >
                             <Plus className="w-4 h-4" /> Add Ingredient
                         </button>
                         <button 
                            onClick={addTempHeader}
                            className="px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-medium hover:border-chef-400 hover:text-chef-600 hover:bg-chef-50 transition-colors flex items-center justify-center gap-2"
                            title="Add a section header"
                         >
                             <Type className="w-4 h-4" /> Section
                         </button>
                     </div>
                 </div>

                 <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-3">
                     <button onClick={() => setShowIngredientEditor(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium">Cancel</button>
                     <button onClick={saveIngredients} className="px-6 py-2 bg-chef-600 text-white rounded-lg font-bold hover:bg-chef-700 shadow-md flex items-center gap-2">
                         <Save className="w-4 h-4" /> Save Changes
                     </button>
                 </div>
             </div>
        </div>
      )}
      
      {showUsedIngredientsModal && !cookMode && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
                <div className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                         <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                            <Refrigerator className="w-6 h-6 text-amber-600" />
                         </div>
                         <div>
                             <h3 className="text-xl font-bold text-gray-800">Did you use it up?</h3>
                             <p className="text-gray-500 text-sm mt-1">
                                 We found these items in your inventory. Select any that you <strong>ran out of</strong> while cooking.
                             </p>
                         </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto mb-6 bg-gray-50 rounded-lg border border-gray-200 p-2 space-y-1">
                         {matchingInventoryItems.map(item => {
                             const isSelected = itemsToRemove.has(item);
                             return (
                                 <button 
                                   key={item}
                                   onClick={() => toggleItemToRemove(item)}
                                   className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${isSelected ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100 hover:border-chef-200'}`}
                                 >
                                     <span className={`font-medium ${isSelected ? 'text-red-700' : 'text-gray-700'}`}>{item}</span>
                                     {isSelected ? (
                                         <div className="flex items-center gap-1 text-xs font-bold text-red-600 bg-white px-2 py-0.5 rounded-full border border-red-100">
                                            <Trash2 className="w-3 h-3" /> Remove
                                         </div>
                                     ) : (
                                         <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                                     )}
                                 </button>
                             );
                         })}
                    </div>

                    <div className="flex gap-3">
                         <button 
                            onClick={handleConfirmUsedIngredients}
                            className="flex-1 py-3 bg-chef-600 text-white font-bold rounded-lg hover:bg-chef-700 transition-colors shadow-lg shadow-chef-100"
                         >
                             {itemsToRemove.size > 0 ? `Remove ${itemsToRemove.size} Items & Finish` : 'Keep Inventory & Finish'}
                         </button>
                    </div>
                </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default RecipeView;
