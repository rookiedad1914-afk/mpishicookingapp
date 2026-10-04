
import React, { useState } from 'react';
import { X, Save, Clock, Users, Flame, Image as ImageIcon, Link as LinkIcon, Plus, Trash2, GripVertical, ListOrdered, FileText } from 'lucide-react';
import { Recipe } from '../types';

interface RecipeEditorModalProps {
  recipe: Recipe;
  onSave: (updated: Recipe) => void;
  onClose: () => void;
}

const RecipeEditorModal: React.FC<RecipeEditorModalProps> = ({ recipe, onSave, onClose }) => {
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'INSTRUCTIONS'>('DETAILS');
  
  // Metadata State
  const [formData, setFormData] = useState({
    title: recipe.title,
    description: recipe.description,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    servings: recipe.servings,
    calories: recipe.calories || 0,
    imageUrl: recipe.imageUrl || '',
    sourceUrl: recipe.sourceUrl || '',
    tags: recipe.tags.join(', ')
  });

  // Instructions State
  const [instructions, setInstructions] = useState<string[]>([...recipe.instructions]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const updatedRecipe: Recipe = {
      ...recipe,
      title: formData.title,
      description: formData.description,
      prepTime: Number(formData.prepTime) || 0,
      cookTime: Number(formData.cookTime) || 0,
      servings: Number(formData.servings) || 1,
      calories: Number(formData.calories) || undefined,
      imageUrl: formData.imageUrl,
      sourceUrl: formData.sourceUrl || undefined,
      tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
      instructions: instructions.filter(i => i.trim())
    };
    onSave(updatedRecipe);
    onClose();
  };

  // Instruction Handlers
  const updateInstruction = (index: number, val: string) => {
    const newInst = [...instructions];
    newInst[index] = val;
    setInstructions(newInst);
  };

  const addInstruction = () => {
    setInstructions([...instructions, '']);
  };

  const removeInstruction = (index: number) => {
    setInstructions(instructions.filter((_, i) => i !== index));
  };

  const moveInstruction = (index: number, direction: 'UP' | 'DOWN') => {
    if (direction === 'UP' && index === 0) return;
    if (direction === 'DOWN' && index === instructions.length - 1) return;
    
    const newInst = [...instructions];
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    [newInst[index], newInst[targetIndex]] = [newInst[targetIndex], newInst[index]];
    setInstructions(newInst);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 rounded-t-xl">
          <h3 className="font-bold text-gray-800 text-lg">Edit Recipe</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
           <button 
             onClick={() => setActiveTab('DETAILS')}
             className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'DETAILS' ? 'border-chef-600 text-chef-700 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
           >
             <FileText className="w-4 h-4" /> Recipe Details
           </button>
           <button 
             onClick={() => setActiveTab('INSTRUCTIONS')}
             className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'INSTRUCTIONS' ? 'border-chef-600 text-chef-700 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
           >
             <ListOrdered className="w-4 h-4" /> Instructions
           </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
          
          {activeTab === 'DETAILS' ? (
            <div className="space-y-5">
               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Title</label>
                  <input 
                    type="text" 
                    value={formData.title} 
                    onChange={(e) => handleChange('title', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg font-bold text-lg text-gray-800 focus:ring-2 focus:ring-chef-500 outline-none"
                    placeholder="Recipe Title"
                  />
               </div>

               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Description</label>
                  <textarea 
                    value={formData.description} 
                    onChange={(e) => handleChange('description', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm text-gray-600 focus:ring-2 focus:ring-chef-500 outline-none h-24 resize-none"
                    placeholder="Brief description of the dish..."
                  />
               </div>

               <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Clock className="w-3 h-3"/> Prep (m)</label>
                      <input 
                        type="number" 
                        value={formData.prepTime}
                        onChange={(e) => handleChange('prepTime', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                      />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Clock className="w-3 h-3"/> Cook (m)</label>
                      <input 
                        type="number" 
                        value={formData.cookTime}
                        onChange={(e) => handleChange('cookTime', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                      />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Users className="w-3 h-3"/> Serves</label>
                      <input 
                        type="number" 
                        value={formData.servings}
                        onChange={(e) => handleChange('servings', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                      />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><Flame className="w-3 h-3"/> Calories</label>
                      <input 
                        type="number" 
                        value={formData.calories}
                        onChange={(e) => handleChange('calories', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                      />
                  </div>
               </div>

               <div className="space-y-3">
                   <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><ImageIcon className="w-3 h-3"/> Image URL</label>
                      <input 
                        type="text" 
                        value={formData.imageUrl} 
                        onChange={(e) => handleChange('imageUrl', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm font-mono text-gray-500"
                        placeholder="https://..."
                      />
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1"><LinkIcon className="w-3 h-3"/> Source URL</label>
                      <input 
                        type="text" 
                        value={formData.sourceUrl} 
                        onChange={(e) => handleChange('sourceUrl', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm font-mono text-gray-500"
                        placeholder="https://..."
                      />
                   </div>
               </div>

               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Tags (comma separated)</label>
                  <input 
                    type="text" 
                    value={formData.tags} 
                    onChange={(e) => handleChange('tags', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Dinner, Chicken, Spicy..."
                  />
               </div>
            </div>
          ) : (
            <div className="space-y-3">
               <div className="flex justify-between items-center mb-2">
                 <h4 className="font-bold text-gray-700">Steps ({instructions.length})</h4>
                 <button onClick={addInstruction} className="text-chef-600 text-sm font-bold flex items-center gap-1 hover:bg-chef-50 px-2 py-1 rounded">
                    <Plus className="w-4 h-4" /> Add Step
                 </button>
               </div>
               
               {instructions.map((step, idx) => (
                 <div key={idx} className="flex gap-2 items-start group">
                    <div className="flex flex-col gap-1 mt-1 text-gray-300">
                        <span className="font-bold text-xs text-center w-6">{idx + 1}</span>
                        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => moveInstruction(idx, 'UP')} disabled={idx === 0} className="hover:text-chef-600 disabled:opacity-30">▲</button>
                            <button onClick={() => moveInstruction(idx, 'DOWN')} disabled={idx === instructions.length - 1} className="hover:text-chef-600 disabled:opacity-30">▼</button>
                        </div>
                    </div>
                    <textarea 
                      value={step}
                      onChange={(e) => updateInstruction(idx, e.target.value)}
                      className="flex-1 p-3 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-chef-500 outline-none resize-none"
                      rows={2}
                    />
                    <button 
                      onClick={() => removeInstruction(idx)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded mt-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                 </div>
               ))}

               {instructions.length === 0 && (
                 <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                    No instructions yet. Click Add Step to begin.
                 </div>
               )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium">Cancel</button>
            <button onClick={handleSave} className="px-6 py-2 bg-chef-600 text-white rounded-lg font-bold hover:bg-chef-700 shadow-md flex items-center gap-2">
                <Save className="w-4 h-4" /> Save Changes
            </button>
        </div>

      </div>
    </div>
  );
};

export default RecipeEditorModal;
