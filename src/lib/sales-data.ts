import raw from "../data/superstore.json";

export type Order = {
  id: number;
  category: string;
  region: string;
  segment: string;
  sales: number;
  quantity: number;
  discount: number;
  profit: number;
};

export const CATEGORIES = ["Furniture", "Office Supplies", "Technology"];
export const REGIONS = ["Central", "East", "South", "West"];
export const SEGMENTS = ["Consumer", "Corporate", "Home Office"];

const DATASET = raw as Order[];

/** Dataset real de Sample Superstore (data/superstore_transformado.csv), sin alterar. */
export function getOrders(): Order[] {
  return DATASET;
}
