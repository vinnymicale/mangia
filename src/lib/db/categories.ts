/**
 * Grocery-aisle classification for ingredient names.
 *
 * This is deliberately a local lookup rather than an LLM call: categories only
 * exist to group a shopping list by aisle, they are needed for manually typed
 * items too, and a wrong guess costs a misplaced line rather than a bad recipe.
 * A table also stays correct offline and costs nothing per save.
 */

/** Aisle headings, in the order a shop is usually walked. */
export const CATEGORIES = [
  'Produce',
  'Meat & Seafood',
  'Dairy & Eggs',
  'Bakery',
  'Pantry',
  'Spices',
  'Frozen',
  'Drinks',
] as const

export type Category = (typeof CATEGORIES)[number]

/**
 * Keywords per aisle. Matching is on whole words against the normalized name,
 * so "cream" does not claim "cream of tartar" -- longer phrases are checked
 * first and win.
 */
const KEYWORDS: Record<Category, string[]> = {
  Produce: [
    'apple', 'apricot', 'artichoke', 'arugula', 'asparagus', 'avocado', 'banana',
    'basil', 'bean sprouts', 'beet', 'bell pepper', 'berries', 'blackberry',
    'blueberry', 'bok choy', 'broccoli', 'brussels sprouts', 'cabbage', 'carrot',
    'cauliflower', 'celery', 'chard', 'cherry', 'chive', 'cilantro', 'corn',
    'cucumber', 'date', 'dill', 'eggplant', 'fennel', 'fig', 'garlic', 'ginger',
    'grape', 'grapefruit', 'green bean', 'green onion', 'herbs', 'jalapeno',
    'kale', 'leek', 'lemon', 'lettuce', 'lime', 'mango', 'melon', 'mint',
    'mushroom', 'nectarine', 'onion', 'orange', 'oregano', 'parsley', 'parsnip',
    'peach', 'pear', 'pea', 'pepper flakes', 'pineapple', 'plum', 'potato',
    'pumpkin', 'radish', 'raspberry', 'rhubarb', 'romaine', 'rosemary', 'sage',
    'scallion', 'shallot', 'spinach', 'squash', 'strawberry', 'sweet potato',
    'thyme', 'tomato', 'turnip', 'watermelon', 'zucchini',
  ],
  'Meat & Seafood': [
    'anchovy', 'bacon', 'beef', 'brisket', 'chicken', 'chorizo', 'clam', 'cod',
    'crab', 'duck', 'ground beef', 'ground pork', 'ground turkey', 'ham',
    'halibut', 'lamb', 'lobster', 'meatball', 'mussel', 'oyster', 'pancetta',
    'pepperoni', 'pork', 'prawn', 'prosciutto', 'salami', 'salmon', 'sardine',
    'sausage', 'scallop', 'shrimp', 'snapper', 'steak', 'tilapia', 'trout',
    'tuna', 'turkey', 'veal', 'venison',
  ],
  'Dairy & Eggs': [
    'butter', 'buttermilk', 'brie', 'cheddar', 'cheese', 'cottage cheese',
    'cream', 'cream cheese', 'creme fraiche', 'egg', 'eggs', 'feta', 'ghee',
    'goat cheese', 'gruyere', 'half and half', 'heavy cream', 'kefir',
    'mascarpone', 'milk', 'mozzarella', 'parmesan', 'pecorino', 'provolone',
    'ricotta', 'sour cream', 'yogurt',
  ],
  Bakery: [
    'baguette', 'bagel', 'brioche', 'bread', 'breadcrumbs', 'bun', 'ciabatta',
    'croissant', 'focaccia', 'naan', 'pita', 'sourdough', 'tortilla',
  ],
  Pantry: [
    'almond', 'baking powder', 'baking soda', 'barley', 'bean', 'black beans',
    'bouillon', 'breadcrumb', 'broth', 'brown sugar', 'cashew', 'chickpea',
    'chocolate', 'cocoa', 'coconut milk', 'cornmeal', 'cornstarch', 'couscous',
    'flour', 'honey', 'hot sauce', 'jam', 'ketchup', 'lentil', 'maple syrup',
    'mayonnaise', 'molasses', 'mustard', 'noodle', 'oat', 'oil', 'olive',
    'olive oil', 'panko', 'pasta', 'peanut butter', 'pecan', 'pine nut',
    'pistachio', 'polenta', 'quinoa', 'raisin', 'rice', 'sesame oil',
    'soy sauce', 'stock', 'sugar', 'tahini', 'tomato paste', 'tomato sauce',
    'tortellini', 'vanilla extract', 'vinegar', 'walnut', 'wine vinegar',
    'worcestershire', 'yeast',
  ],
  Spices: [
    'allspice', 'bay leaf', 'black pepper', 'cardamom', 'cayenne', 'chili flakes',
    'chili powder', 'cinnamon', 'clove', 'coriander', 'cumin', 'curry powder',
    'fennel seed', 'garlic powder', 'nutmeg', 'onion powder', 'paprika',
    'pepper', 'red pepper flakes', 'saffron', 'salt', 'sesame seed', 'spice',
    'star anise', 'turmeric',
  ],
  Frozen: [
    'frozen', 'ice cream', 'puff pastry',
  ],
  Drinks: [
    'beer', 'cider', 'coffee', 'juice', 'seltzer', 'soda', 'tea', 'wine',
  ],
}

/** Keywords sorted longest-first, so the most specific phrase wins. */
const RANKED: { keyword: string; category: Category; pattern: RegExp }[] = Object
  .entries(KEYWORDS)
  .flatMap(([category, keywords]) =>
    keywords.map((keyword) => ({
      keyword,
      category: category as Category,
      // Whole-word match, so "pea" does not fire on "peanut butter".
      pattern: new RegExp(`(?:^|\\s)${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?(?:$|\\s)`),
    })),
  )
  .sort((a, b) => b.keyword.length - a.keyword.length)

/**
 * Best-guess aisle for an ingredient name, or null when nothing matches.
 * The name is expected in normalized form (lowercase, single-spaced).
 */
export function categorize(normalizedName: string): Category | null {
  for (const { category, pattern } of RANKED) {
    if (pattern.test(normalizedName)) return category
  }
  return null
}
