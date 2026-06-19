/*
 * The papercraft desert palette.
 *
 * Warm, slightly desaturated construction-paper tones. Colours are kept as a
 * single object so the whole scene can be re-themed from one place, and so the
 * lighting (which tints everything further) has a consistent base to work from.
 */

export const PALETTE = {
  // Sand, light on the dune crests through to cool shadow in the troughs.
  sandLight: 0xead0a0,
  sandMid: 0xd9b27e,
  sandShadow: 0xb1845a,

  // Sky gradient and the low sun.
  skyTop: 0x8fb6d8,
  skyHorizon: 0xf6cda2,
  sun: 0xfff2c6,
  sunHalo: 0xffd98a,

  // Cacti and their blooms.
  cactus: 0x6f9b5a,
  cactusDark: 0x537a44,
  cactusFlower: 0xe8588f,
  agave: 0x8aa86a,

  // Red-rock mesas and scattered boulders.
  rockRed: 0xc06a44,
  rockBand: 0xd98a5e,
  boulder: 0xb58e68,

  // Drifting paper clouds and the rolling tumbleweed.
  cloud: 0xfbf3e4,
  tumbleweed: 0xa8895a,

  // Scraps kicked up by a dust devil.
  dust: 0xdcc4a2,
  dustDark: 0xbfa078,
} as const;
