
import React, { useState } from 'react';
import { Plus, X, Calendar, ShoppingBag, UtensilsCrossed, Store, PenTool } from 'lucide-react';
import { Recipe, WeeklyPlan, DAYS_OF_WEEK, MEAL_TYPES, DayOfWeek, MealType, DINING_OUT_ID } from '../types';
import RecipeSelector from './RecipeSelector';

interface PlannerProps {
  plan: WeeklyPlan;
  recipes: Recipe[];
  onUpdatePlan: (plan: WeeklyPlan) => void;
  onGenerateShoppingList: () => void;
}

const Planner: React.FC<PlannerProps> = ({ plan, recipes, onUpdatePlan, onGenerateShoppingList }) => {
  const [selectingFor, setSelectingFor] = useState<{ day: DayOfWeek, meal: MealType } | null>(null);

  const handleSelectRecipe = (recipeId: string) => {
    if (!selectingFor) return;
    
    const newPlan = { ...plan };
    if (!newPlan[selectingFor.day]) {
      newPlan[selectingFor.day] = {};
    }
    newPlan[selectingFor.day][selectingFor.meal] = recipeId;
    
    onUpdatePlan(newPlan);
    setSelectingFor(null);
  };

  const handleSetDiningOut = (day: DayOfWeek, meal: MealType) => {
    const newPlan = { ...plan };
    if (!newPlan[day]) {
      newPlan[day] = {};
    }
    newPlan[day][meal] = DINING_OUT_ID;
    onUpdatePlan(newPlan);
  };

  const handleRemoveSlot = (day: DayOfWeek, meal: MealType) => {
    const newPlan = { ...plan };
    if (newPlan[day]) {
      delete newPlan[day][meal];
      if (Object.keys(newPlan[day]).length === 0) {
        delete newPlan[day];
      }
    }
    onUpdatePlan(newPlan);
  };

  const clearPlan = () => {
    if (window.confirm("Are you sure you want to clear the entire week's plan?")) {
      onUpdatePlan({});
    }
  };

  const getRecipe = (id?: string) => recipes.find(r => r.id === id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             <Calendar className="w-6 h-6 text-chef-600" />
             Weekly Meal Plan
           </h2>
           <p className="text-gray-500 text-sm">Plan your meals for the week.</p>
        </div>
        <div className="flex gap-3">
           <button 
             onClick={clearPlan}
             className="px-4 py-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors"
           >
             Clear Plan
           </button>
           <button 
             onClick={onGenerateShoppingList}
             className="flex items-center gap-2 px-5 py-2 bg-chef-600 text-white rounded-lg font-bold hover:bg-chef-700 shadow-lg shadow-chef-100 transition-all"
           >
             <ShoppingBag className="w-4 h-4" />
             Shopping List
           </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Desktop Grid Header */}
        <div className="hidden md:grid grid-cols-8 bg-gray-50 border-b border-gray-200 divide-x divide-gray-200">
          <div className="p-4 font-bold text-gray-400 text-xs uppercase tracking-wider text-center flex items-center justify-center bg-gray-100/50">
            Meal
          </div>
          {DAYS_OF_WEEK.map(day => (
            <div key={day} className="p-3 font-bold text-gray-700 text-center text-sm">
              {day}
            </div>
          ))}
        </div>

        {/* Meal Rows */}
        {MEAL_TYPES.map(meal => (
          <div key={meal} className="flex flex-col md:grid md:grid-cols-8 border-b border-gray-100 last:border-0 divide-y md:divide-y-0 md:divide-x divide-gray-100">
            {/* Row Label */}
            <div className="p-2 md:p-4 bg-gray-50 md:bg-gray-50/30 flex items-center justify-between md:justify-center font-bold text-chef-700 text-sm">
              <span className="md:hidden">Plan for {meal}</span>
              <span className="hidden md:inline">{meal}</span>
            </div>

            {/* Day Slots */}
            {DAYS_OF_WEEK.map(day => {
              const recipeId = plan[day]?.[meal];
              const isDiningOut = recipeId === DINING_OUT_ID;
              const recipe = getRecipe(recipeId);
              // If it's not dining out, and not a matching recipe object, it's a custom text entry
              const isCustom = recipeId && !isDiningOut && !recipe;

              return (
                <div key={day} className="p-2 min-h-[100px] relative group transition-colors hover:bg-gray-50/50">
                  {/* Mobile Label */}
                  <div className="md:hidden text-xs font-bold text-gray-400 mb-1">{day}</div>
                  
                  {isDiningOut ? (
                     <div className="h-full bg-blue-50 border border-blue-100 rounded-lg p-2 shadow-sm flex flex-col items-center justify-center text-center gap-1 group/card">
                         <div className="absolute top-1 right-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                             <button onClick={() => handleRemoveSlot(day, meal)} className="text-blue-300 hover:text-red-500">
                                <X className="w-3.5 h-3.5" />
                             </button>
                         </div>
                         <Store className="w-6 h-6 text-blue-500" />
                         <span className="text-xs font-bold text-blue-700">Eating Out</span>
                     </div>
                  ) : recipe ? (
                    <div className="h-full bg-white border border-gray-200 rounded-lg p-2 shadow-sm flex flex-col gap-2 group/card">
                      <div className="flex justify-between items-start">
                         <div className="w-full">
                            <h4 className="font-bold text-xs text-gray-800 line-clamp-2 leading-tight">{recipe.title}</h4>
                            <div className="flex items-center gap-1 mt-1">
                               <div className="text-[10px] bg-chef-50 text-chef-700 px-1.5 py-0.5 rounded-full inline-block">
                                  {recipe.prepTime + recipe.cookTime}m
                               </div>
                            </div>
                         </div>
                         <button 
                           onClick={() => handleRemoveSlot(day, meal)}
                           className="text-gray-300 hover:text-red-500 -mt-1 -mr-1"
                         >
                           <X className="w-3.5 h-3.5" />
                         </button>
                      </div>
                      <img src={recipe.imageUrl} className="w-full h-16 object-cover rounded bg-gray-100" />
                    </div>
                  ) : isCustom ? (
                    <div className="h-full bg-indigo-50 border border-indigo-100 rounded-lg p-2 shadow-sm flex flex-col gap-1 group/card">
                         <div className="flex justify-between items-start">
                            <h4 className="font-bold text-xs text-indigo-900 line-clamp-3 leading-tight flex-1 pr-1 break-words">{recipeId}</h4>
                            <button
                               onClick={() => handleRemoveSlot(day, meal)}
                               className="text-indigo-300 hover:text-red-500 -mt-1 -mr-1 shrink-0"
                            >
                               <X className="w-3.5 h-3.5" />
                            </button>
                         </div>
                         <div className="mt-auto flex items-center gap-1 text-[10px] text-indigo-400 font-medium uppercase tracking-wide">
                             <PenTool className="w-3 h-3" /> Custom
                         </div>
                    </div>
                  ) : (
                    <div className="w-full h-full min-h-[80px] rounded-lg border-2 border-dashed border-gray-200 hover:border-chef-300 hover:bg-chef-50 flex items-center justify-center transition-all group/empty relative">
                      <button 
                        onClick={() => setSelectingFor({ day, meal })}
                        className="w-full h-full flex items-center justify-center text-gray-300 hover:text-chef-500"
                        title="Add Recipe"
                      >
                        <Plus className="w-6 h-6" />
                      </button>
                      {/* Eating Out Button - Visible on hover */}
                      <button
                        onClick={() => handleSetDiningOut(day, meal)} 
                        className="absolute bottom-1 right-1 p-1 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-full opacity-0 group-hover/empty:opacity-100 transition-all"
                        title="Eat Out"
                      >
                         <UtensilsCrossed className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {selectingFor && (
        <RecipeSelector 
          recipes={recipes} 
          onSelect={handleSelectRecipe}
          onClose={() => setSelectingFor(null)}
        />
      )}
    </div>
  );
};

export default Planner;
