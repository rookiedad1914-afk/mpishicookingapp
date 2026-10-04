
import React, { useMemo, useState, useEffect } from 'react';
import { Plus, X, Refrigerator, Search, ThermometerSnowflake, Archive, Utensils, PackageOpen, GripVertical } from 'lucide-react';
import { MASTER_INGREDIENT_LIST, StorageLocation } from '../types';
import * as storage from '../services/storageService';

interface InventoryViewProps {
  inventory: string[];
  onUpdateInventory: (items: string[]) => void;
}

const COMMON_STAPLES = [
  'Eggs', 'Milk', 'Butter', 'Cheese', 'Onions', 'Garlic', 
  'Potatoes', 'Rice', 'Pasta', 'Tomatoes', 'Chicken', 'Ground Beef'
];

const SPICE_KEYWORDS = [
  'salt', 'pepper', 'powder', 'cinnamon', 'nutmeg', 'paprika', 'cumin', 'turmeric', 
  'oregano', 'basil', 'thyme', 'rosemary', 'dill', 'parsley', 'sage', 'spice', 
  'seasoning', 'vanilla', 'extract', 'clove', 'cardamom', 'ginger', 'coriander'
];

const FRIDGE_KEYWORDS = [
  'milk', 'cream', 'yogurt', 'butter', 'cheese', 'egg', 'meat', 'chicken', 'beef', 
  'pork', 'fish', 'salmon', 'shrimp', 'tofu', 'vegetable', 'fruit', 'lettuce', 
  'spinach', 'kale', 'carrot', 'celery', 'broccoli', 'cauliflower', 'cucumber', 
  'zucchini', 'pepper', 'jalapeno', 'onion', 'garlic', 'scallion', 'lemon', 'lime',
  'apple', 'berry', 'grape', 'mayo', 'mustard', 'ketchup', 'salsa', 'hummus', 'bacon', 'ham'
];

interface ItemChipProps {
  item: string;
  colorClass: string;
  borderClass: string;
  textClass: string;
  onRemove: (item: string) => void;
}

const ItemChip: React.FC<ItemChipProps> = ({ item, colorClass, borderClass, textClass, onRemove }) => {
  
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', item);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div 
      draggable
      onDragStart={handleDragStart}
      className={`flex items-center gap-1.5 ${colorClass} ${textClass} px-2 pl-1 py-1.5 rounded-lg border ${borderClass} group animate-in fade-in zoom-in-95 duration-200 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all max-w-full z-10`}
    >
      <div className="text-gray-300 group-hover:text-gray-400 shrink-0">
        <GripVertical className="w-4 h-4" />
      </div>
      <span className="font-medium text-sm select-none truncate max-w-[140px]" title={item}>{item}</span>
      <button 
        onClick={(e) => { e.stopPropagation(); onRemove(item); }}
        className={`p-0.5 rounded-full hover:bg-white/50 transition-colors ${textClass} shrink-0`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

const InventoryView: React.FC<InventoryViewProps> = ({ inventory, onUpdateInventory }) => {
  const [input, setInput] = useState('');
  const [locationOverrides, setLocationOverrides] = useState<Record<string, StorageLocation>>({});
  const [dragOverZone, setDragOverZone] = useState<StorageLocation | null>(null);

  useEffect(() => {
    setLocationOverrides(storage.getInventoryLocations());
  }, []);

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const match = MASTER_INGREDIENT_LIST.find(
      item => item.toLowerCase() === trimmed.toLowerCase()
    );
    const finalItem = match || trimmed;

    if (!inventory.includes(finalItem)) {
      onUpdateInventory([...inventory, finalItem]);
      setInput('');
    } else {
      setInput('');
    }
  };

  const handleAddStaple = (item: string) => {
    if (!inventory.includes(item)) {
      onUpdateInventory([...inventory, item]);
    }
  };

  const handleRemove = (item: string) => {
    onUpdateInventory(inventory.filter(i => i !== item));
  };

  const handleDrop = (e: React.DragEvent, zone: StorageLocation) => {
    e.preventDefault();
    setDragOverZone(null);
    const item = e.dataTransfer.getData('text/plain');
    if (item && inventory.includes(item)) {
      const newOverrides = { ...locationOverrides, [item]: zone };
      setLocationOverrides(newOverrides);
      storage.saveInventoryLocations(newOverrides);
    }
  };

  const getAutoLocation = (item: string): StorageLocation => {
    // Check override first
    if (locationOverrides[item]) return locationOverrides[item];

    const lower = item.toLowerCase();
    
    if (SPICE_KEYWORDS.some(k => lower.includes(k))) return 'SPICE';
    if (FRIDGE_KEYWORDS.some(k => lower.includes(k))) return 'FRIDGE';
    
    return 'PANTRY';
  };

  // Organize inventory into zones
  const { fridge, pantry, spices } = useMemo(() => {
    const zones = {
      fridge: [] as string[],
      pantry: [] as string[],
      spices: [] as string[]
    };

    inventory.forEach(item => {
      const location = getAutoLocation(item);
      if (location === 'FRIDGE') zones.fridge.push(item);
      else if (location === 'SPICE') zones.spices.push(item);
      else zones.pantry.push(item);
    });

    zones.fridge.sort();
    zones.pantry.sort();
    zones.spices.sort();

    return zones;
  }, [inventory, locationOverrides]);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-1">
            <Refrigerator className="w-6 h-6 text-chef-600" />
            Kitchen Inventory
          </h2>
          <p className="text-gray-500 text-sm">Organize your stock. Drag and drop items to move them.</p>
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 z-20 relative">
        <div className="flex gap-2 mb-6">
          <div className="relative flex-1">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
             <input
                type="text"
                list="ingredient-autocomplete"
                placeholder="Type an ingredient to stock..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-chef-500 focus:border-transparent outline-none shadow-sm"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
             />
             <datalist id="ingredient-autocomplete">
                {MASTER_INGREDIENT_LIST.map(item => (
                  <option key={item} value={item} />
                ))}
             </datalist>
          </div>
          <button 
            onClick={handleAdd}
            disabled={!input.trim()}
            className="px-6 py-2 bg-chef-600 text-white rounded-xl font-bold hover:bg-chef-700 disabled:bg-gray-300 transition-all flex items-center gap-2 shadow-md hover:shadow-lg disabled:shadow-none shrink-0"
          >
            <Plus className="w-5 h-5" /> Add
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">Quick Add:</span>
            {COMMON_STAPLES.map(staple => (
               <button 
                 key={staple}
                 onClick={() => handleAddStaple(staple)}
                 disabled={inventory.includes(staple)}
                 className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                   ${inventory.includes(staple) 
                     ? 'bg-gray-50 border-gray-200 text-gray-400 opacity-50 cursor-default' 
                     : 'bg-white border-gray-200 text-gray-600 hover:border-chef-400 hover:text-chef-600 hover:shadow-sm'}`}
               >
                 {inventory.includes(staple) ? `✓ ${staple}` : `+ ${staple}`}
               </button>
            ))}
        </div>
      </div>

      {/* The Kitchen Zones */}
      <div className="grid md:grid-cols-2 gap-6 items-start">
        
        {/* Refrigerator */}
        <div 
          className={`rounded-2xl border p-5 shadow-sm md:col-span-1 transition-all duration-200
            ${dragOverZone === 'FRIDGE' ? 'bg-sky-100 border-sky-300 ring-2 ring-sky-200' : 'bg-sky-50 border-sky-100'}`}
          onDragOver={(e) => { e.preventDefault(); setDragOverZone('FRIDGE'); }}
          onDragLeave={() => setDragOverZone(null)}
          onDrop={(e) => handleDrop(e, 'FRIDGE')}
        >
           <div className="flex items-center gap-2 mb-4 text-sky-800">
              <ThermometerSnowflake className="w-5 h-5" />
              <h3 className="font-bold text-lg">The Refrigerator</h3>
              <span className="ml-auto bg-sky-100 text-sky-600 text-xs font-bold px-2 py-1 rounded-full">{fridge.length}</span>
           </div>
           <div className="bg-white/60 rounded-xl p-4 min-h-[140px] border border-sky-100/50 backdrop-blur-sm flex flex-col justify-start">
              {fridge.length === 0 ? (
                 <div className="flex flex-col items-center justify-center text-sky-300/50 pointer-events-none py-8 flex-1">
                    <Refrigerator className="w-10 h-10 mb-2" />
                    <span className="text-sm font-medium">Empty Fridge</span>
                 </div>
              ) : (
                 <div className="flex flex-wrap gap-2 content-start">
                    {fridge.map(item => (
                       <ItemChip key={item} item={item} colorClass="bg-white" borderClass="border-sky-100" textClass="text-sky-700" onRemove={handleRemove} />
                    ))}
                 </div>
              )}
           </div>
        </div>

        {/* Spice Rack */}
        <div 
          className={`rounded-2xl border p-5 shadow-sm md:col-span-1 transition-all duration-200
            ${dragOverZone === 'SPICE' ? 'bg-amber-100 border-amber-300 ring-2 ring-amber-200' : 'bg-amber-50 border-amber-100'}`}
          onDragOver={(e) => { e.preventDefault(); setDragOverZone('SPICE'); }}
          onDragLeave={() => setDragOverZone(null)}
          onDrop={(e) => handleDrop(e, 'SPICE')}
        >
           <div className="flex items-center gap-2 mb-4 text-amber-800">
              <Utensils className="w-5 h-5" />
              <h3 className="font-bold text-lg">Spice Rack</h3>
              <span className="ml-auto bg-amber-100 text-amber-600 text-xs font-bold px-2 py-1 rounded-full">{spices.length}</span>
           </div>
           <div className="bg-white/60 rounded-xl p-4 min-h-[140px] border border-amber-100/50 backdrop-blur-sm flex flex-col justify-start">
               {spices.length === 0 ? (
                 <div className="flex flex-col items-center justify-center text-amber-300/50 pointer-events-none py-8 flex-1">
                    <Utensils className="w-10 h-10 mb-2" />
                    <span className="text-sm font-medium">No Spices</span>
                 </div>
              ) : (
                 <div className="flex flex-wrap gap-2 content-start">
                    {spices.map(item => (
                       <ItemChip key={item} item={item} colorClass="bg-white" borderClass="border-amber-100" textClass="text-amber-700" onRemove={handleRemove} />
                    ))}
                 </div>
              )}
           </div>
        </div>

        {/* Pantry */}
        <div 
          className={`rounded-2xl border p-5 shadow-sm md:col-span-2 transition-all duration-200
            ${dragOverZone === 'PANTRY' ? 'bg-stone-100 border-stone-300 ring-2 ring-stone-200' : 'bg-stone-50 border-stone-200'}`}
          onDragOver={(e) => { e.preventDefault(); setDragOverZone('PANTRY'); }}
          onDragLeave={() => setDragOverZone(null)}
          onDrop={(e) => handleDrop(e, 'PANTRY')}
        >
           <div className="flex items-center gap-2 mb-4 text-stone-700">
              <Archive className="w-5 h-5" />
              <h3 className="font-bold text-lg">Pantry & Dry Goods</h3>
              <span className="ml-auto bg-stone-200 text-stone-600 text-xs font-bold px-2 py-1 rounded-full">{pantry.length}</span>
           </div>
           
           {/* Clean "Box" Look instead of lines to avoid alignment issues */}
           <div className="bg-white rounded-xl p-4 min-h-[200px] border-2 border-dashed border-stone-200 relative flex flex-col justify-start">
              {pantry.length === 0 ? (
                 <div className="flex flex-col items-center justify-center text-stone-300 pointer-events-none py-12 flex-1">
                    <PackageOpen className="w-12 h-12 mb-3 opacity-50" />
                    <span className="text-base font-medium">Empty Pantry</span>
                    <span className="text-xs opacity-75 mt-1">Drag items here or add dry goods</span>
                 </div>
              ) : (
                 <div className="flex flex-wrap gap-2 content-start">
                    {pantry.map(item => (
                       <ItemChip key={item} item={item} colorClass="bg-stone-50 hover:bg-white shadow-sm" borderClass="border-stone-200" textClass="text-stone-700" onRemove={handleRemove} />
                    ))}
                 </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryView;
