export const SPORTS_LIST = [
    "Artes Marciales",
    "Atletismo",
    "Baloncesto",
    "Fútbol",
    "Gimnasia",
    "Natación",
    "Porrismo",
    "Tenis",
    "Voleibol",
    "Otro"
] as const;

export type Sport = (typeof SPORTS_LIST)[number];
