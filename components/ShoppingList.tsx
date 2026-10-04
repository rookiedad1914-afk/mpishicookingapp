
import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckSquare, Copy, ArrowLeft, FileSpreadsheet, Filter, Refrigerator,
  Carrot, Beef, Milk, Croissant, Snowflake, Archive, HelpCircle, ShoppingBasket, Plus, Trash2, Search, Smartphone, X, CheckCircle
} from 'lucide-react';
import { Recipe, WeeklyPlan, DAYS_OF_WEEK, MEAL_TYPES, DINING_OUT_ID, COMMON_SEASONINGS, getIngredientCategory, MASTER_INGREDIENT_LIST } from '../types';
import * as storage from '../services/storageService';

interface ShoppingListProps {
  plan: WeeklyPlan;
  recipes: Recipe[];
  inventory: string[];
  onUpdateInventory: (items: string[]) => void;
  onBack: () => void;
  onClearPlan?: () => void;
}

const CATEGORY_ORDER = ['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery', 'Frozen', 'Pantry & Canned', 'Other'];

const CATEGORY_ICONS: Record<string, any> = {
  'Produce': Carrot,
  'Meat & Seafood': Beef,
  'Dairy & Eggs': Milk,
  'Bakery': Croissant,
  'Frozen': Snowflake,
  'Pantry & Canned': Archive,
  'Other': HelpCircle
};

const ShoppingList: React.FC<ShoppingListProps> = ({ plan, recipes, inventory, onUpdateInventory, onBack, onClearPlan }) => {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [manualItems, setManualItems] = useState<string[]>([]);
  const [newItemInput, setNewItemInput] = useState('');
  const [hideSeasonings, setHideSeasonings] = useState(true);
  
  // Modals
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completionStep, setCompletionStep] = useState<'CONFIRM' | 'CLEANUP'>('CONFIRM');
  const [itemsToComplete, setItemsToComplete] = useState<Set<string>>(new Set());

  // Load state on mount
  useEffect(() => {
    const savedChecked = storage.getShoppingListState();
    const savedManual = storage.getManualShoppingItems();
    setCheckedItems(new Set(savedChecked));
    setManualItems(savedManual);
  }, []);

  const handleAddManualItem = () => {
      const trimmed = newItemInput.trim();
      if (!trimmed) return;
      
      const updated = [...manualItems, trimmed];
      setManualItems(updated);
      storage.saveManualShoppingItems(updated);
      setNewItemInput('');
  };

  const handleRemoveManualItem = (e: React.MouseEvent, name: string) => {
      e.preventDefault(); 
      e.stopPropagation();
      
      const index = manualItems.findIndex(i => i.toLowerCase().trim() === name.toLowerCase().trim());
      if (index > -1) {
          const updated = [...manualItems];
          updated.splice(index, 1);
          setManualItems(updated);
          storage.saveManualShoppingItems(updated);
      }
  };

  // Aggregate Ingredients
  const ingredientsMap = new Map<string, { amount: number, unit: string, originalItems: string[], isManualOnly?: boolean }>();

  // 1. Add Plan Items
  DAYS_OF_WEEK.forEach(day => {
    MEAL_TYPES.forEach(meal => {
      const recipeId = plan[day]?.[meal];
      if (recipeId && recipeId !== DINING_OUT_ID) {
        const recipe = recipes.find(r => r.id === recipeId);
        if (recipe) {
          recipe.ingredients.forEach(ing => {
            const key = ing.item.toLowerCase().trim();
            const existing = ingredientsMap.get(key);

            if (existing) {
              if (existing.unit === ing.unit) {
                existing.amount += ing.amount;
              }
              existing.originalItems.push(`${ing.amount} ${ing.unit}`);
            } else {
              ingredientsMap.set(key, {
                amount: ing.amount,
                unit: ing.unit,
                originalItems: [`${ing.amount} ${ing.unit}`]
              });
            }
          });
        } else {
            // Custom Meal Plan Text
            const key = recipeId.toLowerCase().trim();
            const existing = ingredientsMap.get(key);
            
            if (existing) {
                existing.amount += 1;
                existing.originalItems.push('Custom Meal');
            } else {
                ingredientsMap.set(key, {
                    amount: 1,
                    unit: 'meal',
                    originalItems: ['Custom Meal']
                });
            }
        }
      }
    });
  });

  // 2. Add Manual Items
  manualItems.forEach(item => {
      const key = item.toLowerCase().trim();
      const existing = ingredientsMap.get(key);
      if (existing) {
          existing.amount += 1;
          existing.originalItems.push('Manual Add');
      } else {
          ingredientsMap.set(key, {
              amount: 1,
              unit: 'item',
              originalItems: ['Manual Add'],
              isManualOnly: true
          });
      }
  });

  const listItems = Array.from(ingredientsMap.entries()).map(([name, data]) => ({
    name,
    ...data,
    category: getIngredientCategory(name)
  })).sort((a, b) => a.name.localeCompare(b.name));

  // Smart Filtering Logic
  const visibleItems = useMemo(() => {
    return listItems.filter(item => {
      // If filtering is on, check if it's a common seasoning (UNLESS it was manually added, then always show)
      if (hideSeasonings && !item.originalItems.includes('Manual Add')) {
        const isSeasoning = COMMON_SEASONINGS.some(s => item.name.includes(s.toLowerCase()));
        if (isSeasoning) return false;
      }
      return true;
    });
  }, [listItems, hideSeasonings]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, typeof visibleItems> = {};
    CATEGORY_ORDER.forEach(c => groups[c] = []);

    visibleItems.forEach(item => {
      const cat = item.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [visibleItems]);

  const checkInventory = (itemName: string) => {
    return inventory.some(invItem => 
      itemName.includes(invItem.toLowerCase()) || invItem.toLowerCase().includes(itemName)
    );
  };

  const handleToggle = (name: string) => {
    const newSet = new Set<string>(checkedItems);
    const willBeChecked = !newSet.has(name);

    if (willBeChecked) {
      newSet.add(name);
      const existsInInventory = inventory.some(i => i.toLowerCase() === name.toLowerCase());
      if (!existsInInventory) {
          onUpdateInventory([...inventory, name]);
      }
    } else {
      newSet.delete(name);
      const lowerName = name.toLowerCase();
      const newInventory = inventory.filter(i => i.toLowerCase() !== lowerName);
      if (newInventory.length !== inventory.length) {
          onUpdateInventory(newInventory);
      }
    }
    
    setCheckedItems(newSet);
    storage.saveShoppingListState(Array.from(newSet));
  };

  const copyToClipboard = () => {
    let text = '';
    CATEGORY_ORDER.forEach(cat => {
      const items = groupedItems[cat];
      if (items && items.length > 0) {
        text += `\n${cat.toUpperCase()}:\n`;
        items.forEach(i => {
           const isChecked = checkedItems.has(i.name);
           text += `[${isChecked ? 'x' : ' '}] ${i.amount} ${i.unit} ${i.name}\n`;
        });
      }
    });
    navigator.clipboard.writeText(text);
    alert("Shopping list copied to clipboard!");
  };

  const exportToCSV = () => {
    if (visibleItems.length === 0) return;
    const headers = ['Category', 'Status', 'Item', 'Total Amount', 'Unit', 'Notes'];
    const rows = visibleItems.map(item => {
        const isChecked = checkedItems.has(item.name);
        return [
            `"${item.category}"`,
            isChecked ? 'Bought' : 'Needed',
            `"${item.name.replace(/"/g, '""')}"`,
            item.amount,
            item.unit,
            `"${item.originalItems.join(' + ').replace(/"/g, '""')}"`
        ];
    });

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'mpishi_shopping_list.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateShareLink = () => {
    // 1. Flatten the list into simple strings for mobile consumption
    const flatList = visibleItems.map(i => {
        const amountStr = i.amount > 0 ? `${Math.round(i.amount * 100) / 100} ${i.unit === 'unit' ? '' : i.unit} ` : '';
        return `${amountStr}${i.name}`.trim();
    });

    // 2. Base64 Encode
    const json = JSON.stringify(flatList);
    const encoded = btoa(json);
    
    // 3. Construct URL
    const baseUrl = window.location.href.split('?')[0];
    const fullUrl = `${baseUrl}?quickList=${encoded}`;
    
    setShareUrl(fullUrl);
    setShowShareModal(true);
  };

  const openCompleteModal = () => {
      // By default, assume everything is bought (Select All)
      const allItems = new Set(visibleItems.map(i => i.name));
      setItemsToComplete(allItems);
      setCompletionStep('CONFIRM');
      setShowCompleteModal(true);
  };

  const toggleCompletionItem = (name: string) => {
      const newSet = new Set(itemsToComplete);
      if (newSet.has(name)) newSet.delete(name);
      else newSet.add(name);
      setItemsToComplete(newSet);
  };

  const handleCompletePurchase = () => {
      // 1. Add purchased items to inventory (if not present)
      const currentInventory = new Set(inventory.map(i => i.toLowerCase()));
      const itemsToAdd: string[] = [];
      
      itemsToComplete.forEach(item => {
          if (!currentInventory.has(item.toLowerCase())) {
              itemsToAdd.push(item);
          }
      });

      if (itemsToAdd.length > 0) {
          onUpdateInventory([...inventory, ...itemsToAdd]);
      }

      // 2. Update visual Checked State (so list looks done)
      // We merge existing checked items with the new batch
      const newChecked = new Set([...checkedItems, ...itemsToComplete]);
      setCheckedItems(newChecked);
      storage.saveShoppingListState(Array.from(newChecked));

      // 3. Clean up Manual Items if they were purchased
      // (Assumption: If you manually added "Milk" and bought it, you don't need it in the "Manual Add" list anymore)
      const newManual = manualItems.filter(m => !itemsToComplete.has(m.trim()));
      if (newManual.length !== manualItems.length) {
          setManualItems(newManual);
          storage.saveManualShoppingItems(newManual);
      }

      // 4. Move to cleanup step
      setCompletionStep('CLEANUP');
  };

  const handleFinishCompletion = (clearPlan: boolean) => {
      if (clearPlan && onClearPlan) {
          onClearPlan();
          // Clear checked state as well since plan is gone
          setCheckedItems(new Set());
          storage.saveShoppingListState([]);
      }
      setShowCompleteModal(false);
  };

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-chef-600 font-medium transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Planner
        </button>
        <div className="flex flex-wrap gap-2">
            <button 
                onClick={openCompleteModal}
                className="flex items-center gap-2 px-4 py-2 bg-chef-600 text-white rounded-lg hover:bg-chef-700 font-bold shadow-md shadow-chef-200 transition-colors text-sm"
                title="Mark items as purchased"
            >
                <CheckCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Complete Shop</span>
            </button>
            <button 
                onClick={generateShareLink}
                className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-100 font-medium shadow-sm transition-colors text-sm"
                title="Send to Mobile"
            >
                <Smartphone className="w-4 h-4" />
                <span className="hidden sm:inline">Send to Mobile</span>
            </button>
            <button 
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium shadow-sm transition-colors text-sm"
                title="Copy to Clipboard"
            >
                <Copy className="w-4 h-4" />
            </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-chef-50/50">
           <div className="flex justify-between items-start md:items-center mb-4 flex-col md:flex-row gap-4">
               <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <CheckSquare className="w-6 h-6 text-chef-600" />
                    Shopping List
                </h2>
                <p className="text-gray-500 mt-1">
                    {checkedItems.size} of {visibleItems.length} items collected
                </p>
               </div>
               
               <div className="flex items-center gap-3">
                   <button 
                     onClick={() => setHideSeasonings(!hideSeasonings)}
                     className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${hideSeasonings ? 'bg-chef-100 text-chef-700 border-chef-200' : 'bg-white text-gray-500 border-gray-200'}`}
                     title="Toggle Common Pantry Items"
                   >
                     <Filter className="w-4 h-4" />
                     {hideSeasonings ? 'Seasonings Hidden' : 'Show Seasonings'}
                   </button>
                   <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-100 shrink-0">
                      <span className="font-bold text-chef-600">{visibleItems.length}</span>
                   </div>
               </div>
           </div>

           {/* Add Item Input */}
           <div className="flex gap-2">
             <div className="relative flex-1">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                 <input 
                    type="text" 
                    list="shopping-list-autocomplete"
                    placeholder="Type to add extra items..."
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-chef-500 outline-none text-sm shadow-sm"
                    value={newItemInput}
                    onChange={(e) => setNewItemInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddManualItem()}
                 />
                 <datalist id="shopping-list-autocomplete">
                    {MASTER_INGREDIENT_LIST.map(item => (
                      <option key={item} value={item} />
                    ))}
                 </datalist>
             </div>
             <button 
               onClick={handleAddManualItem}
               disabled={!newItemInput.trim()}
               className="px-4 py-2.5 bg-chef-600 text-white rounded-lg font-bold text-sm hover:bg-chef-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-sm"
             >
                <Plus className="w-4 h-4" />
             </button>
           </div>
        </div>

        <div className="divide-y divide-gray-100">
          {visibleItems.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <ShoppingBasket className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Your list is empty. Add recipes to the planner or type items above.</p>
            </div>
          ) : (
            CATEGORY_ORDER.map(category => {
              const items = groupedItems[category];
              if (!items || items.length === 0) return null;
              
              const Icon = CATEGORY_ICONS[category] || HelpCircle;

              return (
                <div key={category}>
                  {/* Category Header */}
                  <div className="bg-gray-50/80 px-4 py-2 flex items-center gap-2 border-y border-gray-100 sticky top-0 backdrop-blur-sm z-10">
                    <Icon className="w-4 h-4 text-chef-600" />
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{category}</h3>
                  </div>
                  
                  {/* Items */}
                  {items.map((item, idx) => {
                    const isChecked = checkedItems.has(item.name);
                    const inStock = checkInventory(item.name);
                    const isManual = item.originalItems.includes('Manual Add');

                    return (
                      <label key={`${category}-${item.name}`} className={`flex items-start p-4 cursor-pointer group transition-all duration-200 border-b border-gray-50 last:border-0 ${isChecked ? 'bg-gray-50' : 'hover:bg-white'}`}>
                          <div className="pt-1">
                              <input 
                                  type="checkbox" 
                                  checked={isChecked}
                                  onChange={() => handleToggle(item.name)}
                                  className="w-5 h-5 text-chef-600 border-gray-300 rounded focus:ring-chef-500 cursor-pointer accent-chef-600" 
                              />
                          </div>
                          <div className={`ml-4 flex-1 transition-opacity duration-200 ${isChecked ? 'opacity-50' : 'opacity-100'}`}>
                              <div className="flex items-center gap-2 flex-wrap">
                                  <div className={`font-bold capitalize text-lg ${isChecked ? 'text-gray-500 line-through decoration-gray-400' : 'text-gray-800 group-hover:text-chef-700'}`}>
                                      {item.name}
                                  </div>
                                  {inStock && (
                                      <span className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold border border-green-200">
                                          <Refrigerator className="w-3 h-3" /> In Stock
                                      </span>
                                  )}
                              </div>
                              <div className="text-sm text-gray-500 mt-0.5 flex items-center justify-between">
                                  <div>
                                    <span className="font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded text-xs mr-2">
                                        {Math.round(item.amount * 100) / 100} {item.unit}
                                    </span>
                                    {(item.originalItems.length > 1 || (!item.isManualOnly && !item.originalItems[0].includes(item.unit))) && (
                                        <span className="text-xs text-gray-400">({item.originalItems.join(' + ')})</span>
                                    )}
                                  </div>
                                  {isManual && (
                                      <button 
                                        onClick={(e) => handleRemoveManualItem(e, item.name)}
                                        className="text-gray-300 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
                                        title="Remove manual entry"
                                      >
                                          <Trash2 className="w-4 h-4" />
                                      </button>
                                  )}
                              </div>
                          </div>
                      </label>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Complete Trip Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
               {completionStep === 'CONFIRM' ? (
                   <>
                       <div className="p-4 border-b border-gray-100 bg-chef-50/50 flex items-center justify-between">
                           <h3 className="text-lg font-bold text-gray-800">Did you find everything?</h3>
                           <button onClick={() => setShowCompleteModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
                       </div>
                       
                       <div className="p-4 flex-1 overflow-y-auto bg-gray-50/30">
                           <p className="text-sm text-gray-500 mb-4">Select the items you bought. They will be added to your inventory.</p>
                           
                           <div className="flex gap-2 mb-4 text-xs font-bold">
                               <button onClick={() => setItemsToComplete(new Set(visibleItems.map(i => i.name)))} className="text-chef-600 hover:underline">Select All</button>
                               <span className="text-gray-300">|</span>
                               <button onClick={() => setItemsToComplete(new Set())} className="text-gray-400 hover:text-gray-600 hover:underline">Unselect All</button>
                           </div>

                           <div className="space-y-1">
                               {visibleItems.map(item => (
                                   <div 
                                      key={item.name} 
                                      onClick={() => toggleCompletionItem(item.name)}
                                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${itemsToComplete.has(item.name) ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}
                                   >
                                       <div className={`w-5 h-5 rounded border flex items-center justify-center ${itemsToComplete.has(item.name) ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'}`}>
                                            {itemsToComplete.has(item.name) && <X className="w-3 h-3 text-white rotate-45" />} 
                                            {/* Using rotated X as checkmark or just empty/filled logic */}
                                       </div>
                                       <span className={`font-medium ${itemsToComplete.has(item.name) ? 'text-green-800' : 'text-gray-600'}`}>{item.name}</span>
                                   </div>
                               ))}
                           </div>
                       </div>
                       
                       <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-white">
                           <button onClick={() => setShowCompleteModal(false)} className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
                           <button 
                             onClick={handleCompletePurchase}
                             className="px-6 py-2 bg-chef-600 text-white font-bold rounded-lg hover:bg-chef-700 shadow-md shadow-chef-100 flex items-center gap-2"
                           >
                             <CheckCircle className="w-4 h-4" /> Confirm Purchase
                           </button>
                       </div>
                   </>
               ) : (
                   <div className="p-8 text-center">
                       <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in spin-in-12 duration-500">
                           <Refrigerator className="w-8 h-8" />
                       </div>
                       <h3 className="text-2xl font-bold text-gray-800 mb-2">Inventory Updated!</h3>
                       <p className="text-gray-500 mb-8">
                           Your purchased items have been stocked in the kitchen. <br/>
                           Would you like to clear the weekly planner to start fresh?
                       </p>
                       
                       <div className="flex flex-col gap-3">
                           {onClearPlan && (
                               <button 
                                 onClick={() => handleFinishCompletion(true)}
                                 className="w-full py-3 bg-chef-600 text-white font-bold rounded-xl hover:bg-chef-700 shadow-lg shadow-chef-100 transition-transform active:scale-[0.98]"
                               >
                                 Yes, Clear Plan & Start Fresh
                               </button>
                           )}
                           <button 
                             onClick={() => handleFinishCompletion(false)}
                             className="w-full py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50"
                           >
                             No, Keep Plan
                           </button>
                       </div>
                   </div>
               )}
           </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center">
                  <div className="flex justify-end">
                      <button onClick={() => setShowShareModal(false)} className="text-gray-400 hover:text-gray-600">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Smartphone className="w-8 h-8 text-indigo-600" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Scan on Mobile</h3>
                  <p className="text-sm text-gray-500 mb-6">
                      Scan this code with your phone camera to instantly load this shopping list.
                  </p>

                  <div className="bg-white p-2 border-2 border-gray-100 rounded-xl inline-block mb-6">
                      {/* Using a reliable QR code API for display */}
                      <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`} 
                          alt="Scan to share list"
                          className="w-48 h-48"
                      />
                  </div>
                  
                  <button 
                    onClick={() => {
                        navigator.clipboard.writeText(shareUrl);
                        alert("Link copied!");
                    }}
                    className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                  >
                      Copy Link Manually
                  </button>
             </div>
        </div>
      )}
    </div>
  );
};

export default ShoppingList;
