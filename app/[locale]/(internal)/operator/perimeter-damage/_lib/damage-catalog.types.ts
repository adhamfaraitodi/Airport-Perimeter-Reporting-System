export interface DamageItemDto {
  id: string;
  name: string;
  exclusiveGroup?: string;
}

export interface CatalogPartDto {
  id: string;
  name: string;
  sortOrder?: number;
  damages: DamageItemDto[];
}

export function slugifyCatalogId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
