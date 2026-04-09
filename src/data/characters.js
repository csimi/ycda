export const npcs = [
  {
    id: 101,
    name: "Mira",
    role: "Innkeeper",
    avatar: "👩",
    disposition: "friendly",
    note: "Knows local rumours. Owes a favour.",
  },
  {
    id: 102,
    name: "Thane Vorrick",
    role: "Guard Captain",
    avatar: "💂",
    disposition: "neutral",
    note: "Suspicious of outsiders. Bribeable.",
  },
  {
    id: 103,
    name: "The Hollow One",
    role: "Unknown",
    avatar: "👤",
    disposition: "hostile",
    note: "Encountered in the forest. Motives unclear.",
  },
];

export const characters = [
  {
    id: 1,
    name: "Aelindra",
    class: "Ranger",
    avatar: "🧝",
    isPlayer: true,
    stats: {
      HP: { value: 72, max: 80 },
      MP: { value: 45, max: 60 },
      STR: 14,
      DEX: 18,
      INT: 12,
    },
  },
  {
    id: 2,
    name: "Gorvath",
    class: "Warrior",
    avatar: "🧔",
    isPlayer: false,
    stats: {
      HP: { value: 95, max: 110 },
      MP: { value: 10, max: 20 },
      STR: 20,
      DEX: 10,
      INT: 8,
    },
  },
  {
    id: 3,
    name: "Sylvara",
    class: "Mage",
    avatar: "🧙",
    isPlayer: false,
    stats: {
      HP: { value: 40, max: 55 },
      MP: { value: 90, max: 100 },
      STR: 7,
      DEX: 12,
      INT: 22,
    },
  },
];
