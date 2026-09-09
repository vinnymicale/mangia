// Recipe content for the development seed, taken from the design mockup at
// docs/superpowers/specs/mangia-design-reference.html.
//
// Split out from seed-dev.mjs so the data can be loaded without pulling in the
// native better-sqlite3 binding, which needs a matching Node ABI.

/* ── Content ─────────────────────────────────────────────────────────── */

// Ingredient categories match the shopping-list groupings in the mockup.
export const CATEGORIES = {
  produce: 'Produce & Fresh',
  pasta: 'Pasta & Grains',
  dairy: 'Dairy & Cheese',
  liquids: 'Wine & Liquids',
  pantry: 'Pantry Basics',
  seasoning: 'Seasonings & Spices',
  meat: 'Meat & Seafood',
}

/**
 * Staples, grouped as the mockup's Staples screen groups them. These are
 * excluded from shopping lists and count toward pantry coverage, so the set
 * has to be things a kitchen genuinely always has.
 */
export const STAPLES = [
  ['extra-virgin olive oil', CATEGORIES.pantry],
  ['unsalted butter', CATEGORIES.dairy],
  ['red wine vinegar', CATEGORIES.pantry],
  ['white wine vinegar', CATEGORIES.pantry],
  ['coarse sea salt', CATEGORIES.seasoning],
  ['black pepper', CATEGORIES.seasoning],
  ['dried chilli flakes', CATEGORIES.seasoning],
  ['bay leaves', CATEGORIES.seasoning],
  ['dried oregano', CATEGORIES.seasoning],
  ['canned san marzano tomatoes', CATEGORIES.pantry],
  ['cannellini beans', CATEGORIES.pantry],
  ['chicken stock', CATEGORIES.pantry],
  ['vegetable stock', CATEGORIES.pantry],
  ['capers', CATEGORIES.pantry],
  ['arborio rice', CATEGORIES.pasta],
  ['breadcrumbs', CATEGORIES.pasta],
  ['00 flour', CATEGORIES.pasta],
]

export const RECIPES = [
  {
    title: 'Spaghetti alle Vongole',
    description:
      'Briny, garlicky, and touched with white wine — this Neapolitan classic is weeknight-fast but tastes like a Sunday by the sea.',
    sourceUrl: 'https://www.giallozafferano.it/ricette/Spaghetti-alle-vongole.html',
    prepMinutes: 10,
    cookMinutes: 20,
    servings: 4,
    tags: ['Pasta', 'Seafood'],
    ingredients: [
      [500, 'g', 'spaghetti', null, CATEGORIES.pasta],
      [1, 'kg', 'small clams', 'cleaned, soaked', CATEGORIES.meat],
      [4, null, 'garlic cloves', 'thinly sliced', CATEGORIES.produce],
      [150, 'ml', 'dry white wine', null, CATEGORIES.liquids],
      [60, 'ml', 'extra-virgin olive oil', null, CATEGORIES.pantry],
      [1, null, 'small dried chilli', 'peperoncino', CATEGORIES.seasoning],
      [1, 'handful', 'flat-leaf parsley', 'roughly chopped', CATEGORIES.produce],
      [null, null, 'salt & black pepper', 'to taste', CATEGORIES.seasoning],
    ],
    steps: [
      'Bring a large pot of well-salted water to a rolling boil. Cook the spaghetti until 2 minutes shy of al dente, reserving 200 ml of pasta water before draining.',
      'Warm the olive oil in a wide, lidded sauté pan over medium heat. Add the garlic and chilli; cook gently for 90 seconds until fragrant but not coloured.',
      'Add the clams and pour in the white wine. Raise the heat to high, cover tightly, and steam for 3–4 minutes, shaking the pan occasionally, until all shells have opened. Discard any that remain closed.',
      'Lift the clams out with a slotted spoon. Shell about half; leave the rest whole for presentation. Pour any collected juices back into the pan.',
      'Add the underdone spaghetti to the pan along with a splash of pasta water. Toss vigorously over medium-high heat for 2 minutes until the pasta finishes cooking and the sauce clings in a glossy coat.',
      'Return the clams, scatter over the parsley, and taste for seasoning. Serve immediately — vongole wait for no one.',
    ],
  },
  {
    title: 'Ribollita Toscana',
    description:
      'Hearty Tuscan bread soup with cavolo nero, cannellini beans, and day-old bread.',
    prepMinutes: 20,
    cookMinutes: 40,
    servings: 6,
    tags: ['Soup'],
    ingredients: [
      [400, 'g', 'cavolo nero', 'stems stripped', CATEGORIES.produce],
      [400, 'g', 'cannellini beans', 'cooked or canned', CATEGORIES.pantry],
      [300, 'g', 'day-old sourdough', 'torn into chunks', CATEGORIES.pasta],
      [2, null, 'carrots', 'diced', CATEGORIES.produce],
      [2, null, 'celery stalks', 'diced', CATEGORIES.produce],
      [1, null, 'yellow onion', 'diced', CATEGORIES.produce],
      [400, 'g', 'canned san marzano tomatoes', null, CATEGORIES.pantry],
      [1.5, 'l', 'vegetable stock', null, CATEGORIES.pantry],
      [60, 'ml', 'extra-virgin olive oil', 'plus more to finish', CATEGORIES.pantry],
    ],
    steps: [
      'Sweat the onion, carrot, and celery in the olive oil over low heat for 15 minutes, until soft and sweet but not browned.',
      'Add the tomatoes and cook down for 10 minutes, stirring occasionally, until the mixture darkens and no longer tastes raw.',
      'Pour in the stock and add the cannellini beans. Simmer for 15 minutes.',
      'Stir in the cavolo nero and cook until fully tender, about 10 minutes more.',
      'Fold in the torn bread and let it sit off the heat for 20 minutes to swell and thicken the soup.',
      'Serve in wide bowls with a hard pour of good olive oil over each. Better still the next day, which is the whole point of the name.',
    ],
  },
  {
    title: 'Risotto ai Funghi Porcini',
    description:
      'Earthy porcini, aged Parmigiano, and white wine stirred into a glossy silk.',
    prepMinutes: 10,
    cookMinutes: 30,
    servings: 4,
    tags: ['Risotto'],
    ingredients: [
      [320, 'g', 'arborio rice', null, CATEGORIES.pasta],
      [40, 'g', 'dried porcini mushrooms', 'soaked in warm water', CATEGORIES.pantry],
      [250, 'g', 'chestnut mushrooms', 'sliced', CATEGORIES.produce],
      [1.2, 'l', 'chicken stock', 'kept at a bare simmer', CATEGORIES.pantry],
      [120, 'ml', 'dry white wine', null, CATEGORIES.liquids],
      [80, 'g', 'parmigiano reggiano', 'finely grated', CATEGORIES.dairy],
      [50, 'g', 'unsalted butter', 'cold, cubed', CATEGORIES.dairy],
      [1, null, 'shallot', 'finely minced', CATEGORIES.produce],
    ],
    steps: [
      'Soak the porcini in 300 ml of warm water for 20 minutes. Lift them out, chop, and strain the soaking liquid into the stock.',
      'Sauté the shallot in half the butter until translucent. Add both mushrooms and cook until they have given up their water and started to colour.',
      'Add the rice and toast for 2 minutes, stirring, until the grains turn translucent at the edges.',
      'Pour in the wine and stir until fully absorbed.',
      'Add hot stock a ladle at a time, stirring often and waiting for each addition to be absorbed before the next. Expect about 18 minutes.',
      'Off the heat, beat in the remaining cold butter and the Parmigiano. Cover for 2 minutes, then stir once more — it should ripple, not stand up.',
    ],
  },
  {
    title: 'Pollo al Limone',
    description:
      'Pan-seared thighs finished in a bright lemon and white wine pan sauce.',
    prepMinutes: 10,
    cookMinutes: 25,
    servings: 4,
    tags: ['Chicken'],
    ingredients: [
      [8, null, 'chicken thighs', 'bone-in, skin-on', CATEGORIES.meat],
      [2, null, 'lemons', 'one juiced, one sliced', CATEGORIES.produce],
      [150, 'ml', 'dry white wine', null, CATEGORIES.liquids],
      [200, 'ml', 'chicken stock', null, CATEGORIES.pantry],
      [3, null, 'garlic cloves', 'smashed', CATEGORIES.produce],
      [30, 'g', 'unsalted butter', null, CATEGORIES.dairy],
      [2, 'tbsp', 'capers', 'rinsed', CATEGORIES.pantry],
      [4, 'sprigs', 'thyme', null, CATEGORIES.produce],
    ],
    steps: [
      'Season the thighs generously and leave them at room temperature for 20 minutes. Dry the skin thoroughly.',
      'Sear skin-side down in a cold, dry ovenproof pan brought slowly to medium heat, 10–12 minutes, until the skin is deeply golden and releases on its own.',
      'Turn, add the garlic and thyme, and cook 5 minutes more. Move the chicken to a plate.',
      'Pour off most of the fat. Deglaze with the wine, scraping the pan, and reduce by half.',
      'Add the stock, lemon juice, and capers. Simmer until lightly syrupy, then whisk in the butter off the heat.',
      'Return the chicken skin-side up, tuck in the lemon slices, and spoon the sauce around — never over — the crisp skin.',
    ],
  },
  {
    title: 'Cacio e Pepe',
    description:
      "Three ingredients, one technique. Rome's greatest pasta asks nothing more than attention.",
    prepMinutes: 5,
    cookMinutes: 15,
    servings: 2,
    tags: ['Pasta', 'Quick'],
    ingredients: [
      [200, 'g', 'spaghetti', 'or tonnarelli', CATEGORIES.pasta],
      [150, 'g', 'pecorino romano', 'finely grated', CATEGORIES.dairy],
      [75, 'g', 'parmigiano reggiano', 'finely grated', CATEGORIES.dairy],
      [2, 'tsp', 'black pepper', 'coarsely cracked, toasted', CATEGORIES.seasoning],
    ],
    steps: [
      'Boil the pasta in a small volume of well-salted water so the water turns properly starchy.',
      'Toast the cracked pepper in a dry pan for 30 seconds until fragrant.',
      'Whisk the grated cheeses with a few tablespoons of cooled pasta water into a smooth paste — cooled, or it will seize.',
      'Drain the pasta, reserving plenty of water. Add the pasta to the pepper pan off the heat.',
      'Add the cheese paste and toss hard, loosening with pasta water until the sauce turns glossy and coats every strand.',
      'Serve at once in warmed bowls, with more pepper.',
    ],
  },
  {
    title: 'Panzanella',
    description:
      'Tuscan bread salad with ripe tomatoes, basil, and red onion soaked in good olive oil.',
    prepMinutes: 20,
    cookMinutes: 5,
    servings: 4,
    tags: ['Salad', 'Quick'],
    ingredients: [
      [600, 'g', 'ripe tomatoes', 'mixed sizes, torn', CATEGORIES.produce],
      [300, 'g', 'day-old sourdough', 'torn, lightly toasted', CATEGORIES.pasta],
      [1, null, 'red onion', 'thinly sliced', CATEGORIES.produce],
      [1, 'bunch', 'basil', 'leaves torn', CATEGORIES.produce],
      [3, 'tbsp', 'red wine vinegar', null, CATEGORIES.pantry],
      [80, 'ml', 'extra-virgin olive oil', null, CATEGORIES.pantry],
      [1, 'tbsp', 'capers', 'rinsed', CATEGORIES.pantry],
    ],
    steps: [
      'Salt the torn tomatoes in a colander set over a bowl and leave for 20 minutes. Keep the juice that collects — it is the dressing.',
      'Soak the sliced red onion in the vinegar while the tomatoes drain, to take off its raw edge.',
      'Toast the torn bread until dry and just golden at the edges but still chewy inside.',
      'Whisk the tomato juice with the olive oil and the onion vinegar, and season.',
      'Toss everything together and let it sit for 30 minutes before serving, so the bread drinks the dressing without going to mush.',
    ],
  },
]
