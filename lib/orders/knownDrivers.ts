export type KnownDriver = {
  id: string;
  name: string;
  aliases: readonly string[];
};

export const KNOWN_DRIVERS: readonly KnownDriver[] = [
  { id: "gints", name: "Gints", aliases: [] },
  { id: "matiss", name: "Matiss", aliases: [] },
  { id: "otto", name: "Otto", aliases: [] },
  { id: "ronalds", name: "Ronalds", aliases: [] },
  { id: "altin", name: "Altin", aliases: [] },
  { id: "arno", name: "Arno", aliases: [] },
  { id: "edijs", name: "Edijs", aliases: [] },
  { id: "gabriel", name: "Gabriel", aliases: [] },
  { id: "learning-team", name: "Learning team", aliases: [] },
  { id: "maris", name: "Maris", aliases: [] },
  { id: "norsen", name: "Norsen", aliases: [] },
];
