// What a physical, NFC-tagged Papillon piece actually is.
//
// artifacts.item_type was a dead column for a long time: the minter never set
// it, nothing read it, and every row carried the default 'CLOTHING'. With no
// working field, the item type got smuggled into the artifact's name instead.
// db/artifact_item_type.sql constrains the column to this vocabulary.
//
// Aligned with the physical values already in products.category (CAP, HOODIE,
// TEE) so the two tables describe goods the same way, plus KEYCHAIN and an
// OTHER escape hatch so an unforeseen product never blocks a mint.
//
// KEEP IN SYNC with the CHECK constraint in db/artifact_item_type.sql and the
// mirror in api/v2/admin/mint.js. The DB constraint is the authority: if these
// drift, the insert fails loudly rather than storing a bad value.

export const ITEM_TYPES = [
  'KEYCHAIN',
  'HOODIE',
  'TEE',
  'CAP',
  'JACKET',
  'STICKER',
  'OTHER',
] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

export const isItemType = (v: string): v is ItemType =>
  (ITEM_TYPES as readonly string[]).includes(v);
