const PROFILES = {
    café: {
        label: 'Café',
        icon: '☕',
        systemContext: `
This is a CAFÉ. Key concerns:
- Peak hours: 7-10am and 2-4pm
- Coffee beans and milk are highest-volume ingredients
- Beverage margins usually outperform food
- Regulars drive predictable daily demand
`
    },
    cafeteria: {
        label: 'University Cafeteria',
        icon: '🍽️',
        systemContext: `
This is a UNIVERSITY CAFETERIA. Key concerns:
- Steady student demand peaks at lunch (12-14) and between classes
- Volume matters more than margin — students are price-sensitive
- Semester schedule affects daily demand
- Waste from unsold prepared food is the biggest cost driver
- Bulk purchasing reduces cost per unit
`
    },
    bakery: {
        label: 'Bakery',
        icon: '🥐',
        systemContext: `
This is a BAKERY. Key concerns:
- Perishable goods with daily production cycles
- Morning production peaks (5-9am)
- Waste from over-baking is a major cost driver
- Recipes yield batches, not individual units
- Weather and weekday patterns drive demand
`
    },
    restaurant: {
        label: 'Restaurant',
        icon: '🍽️',
        systemContext: `
This is a RESTAURANT. Key concerns:
- Menu engineering (stars, plow horses, puzzles, dogs)
- Food cost ratios matter more than gross margin
- Portion control drives consistency
- Dinner service drives most revenue
`
    },
    coffee_shop: {
        label: 'Coffee Shop',
        icon: '☕',
        systemContext: `
This is a COFFEE SHOP. Key concerns:
- Bean consumption per drink type
- Milk spoilage (2-3 day window)
- Morning rush throughput
- Regulars' order patterns
`
    },
    food_truck: {
        label: 'Food Truck',
        icon: '🚚',
        systemContext: `
This is a FOOD TRUCK. Key concerns:
- Limited storage (fit in truck)
- Location-dependent demand
- Weather affects turnout
- Must minimize both waste AND stockouts
`
    }
};

function getProfile(type) {
    return PROFILES[type] || PROFILES['cafeteria'];
}

function enhanceSystemPrompt(basePrompt, cafe) {
    const profile = getProfile(cafe?.type);
    return `${basePrompt}

--- BUSINESS CONTEXT ---
Cafeteria: ${cafe?.name || 'Food Market SA business'}
Type: ${profile.label}
Timezone: ${cafe?.timezone || 'Africa/Johannesburg'}
Currency: ${cafe?.currency || 'ZAR'}

${profile.systemContext}
`;
}

module.exports = { PROFILES, getProfile, enhanceSystemPrompt };
