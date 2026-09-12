export const BASE_PRICE = 248000;

export const PAINTS = [
  { name: "Glacier Silver", hex: 0xc9ced3, metalness: 0.90, roughness: 0.26, price: 0 },
  { name: "Obsidian Noir", hex: 0x0b0c0e, metalness: 0.86, roughness: 0.30, price: 1800 },
  { name: "Storm Graphite", hex: 0x41464d, metalness: 0.90, roughness: 0.28, price: 1400 },
  { name: "Ceramic Blanc", hex: 0xe6e7e8, metalness: 0.62, roughness: 0.32, price: 900 },
  { name: "Midnight Sapphire", hex: 0x16305e, metalness: 0.88, roughness: 0.26, price: 3200 },
  { name: "Rosso Veloce", hex: 0x7e1113, metalness: 0.80, roughness: 0.30, price: 3400 },
  { name: "Verde Silverstone", hex: 0x14382a, metalness: 0.85, roughness: 0.28, price: 3200 },
  { name: "Champagne Aurum", hex: 0xb9a077, metalness: 0.92, roughness: 0.24, price: 4800 },
];

export const WHEELS = [
  { id: "ST1", name: 'Aurion 10 Forgé', desc: "10-spoke forged alloy · gunmetal", price: 0 },
  { id: "ST2", name: "Turbine 5", desc: "Twin-blade turbine · gloss black", price: 4900 },
  { id: "ST3", name: "Aero Mesh 20", desc: "20-spoke aero mesh · machined silver", price: 6400 },
];

export const TRIMS = [
  { name: "Onyx Noir", leather: 0x0a0a0b, suede: 0x101114, price: 0 },
  { name: "Cognac Terroir", leather: 0x4a2c18, suede: 0x2a2016, price: 3900 },
  { name: "Ivory Atelier", leather: 0xcfc7b8, suede: 0x8a8478, price: 4200 },
  { name: "Slate Dinamica", leather: 0x2b2f35, suede: 0x1d2025, price: 2600 },
];

export const CALIPERS = [
  { id: "blue", name: "Azur", hex: 0x0a3f96 },
  { id: "red", name: "Rosso", hex: 0x9c1414 },
  { id: "silver", name: "Argent", hex: 0xb4b8bd },
  { id: "black", name: "Noir", hex: 0x0e0f11 },
];

export const EQUIP = [
  { id: "sills", name: "Illuminated Door Sills", desc: "Soft-white sill illumination", price: 950 },
  { id: "ambient", name: "Ambient Cabin Lighting", desc: "Warm footwell and console light", price: 1450 },
  { id: "blackTrim", name: "Gloss Black Exterior Trim", desc: "Mirrors, badges and trim in piano black", price: 1100 },
  { id: "privacy", name: "Privacy Glass", desc: "Deep-tint acoustic glazing", price: 850 },
];

export const SPECS = [
  { id: "specRange", value: "612", label: "km WLTP range" },
  { id: "specPower", value: "780", label: "kW output" },
  { id: "specAccel", value: "2.9", label: "s 0–100 km/h" },
  { id: "specTop", value: "295", label: "km/h top speed" },
];

export const CAMERAS = {
  hero: { pos: [5.7, 2.35, -5.5], target: [0, 0.55, 0] },
  front: { pos: [9.4, 1.5, -1.1], target: [0.4, 0.58, 0] },
  side: { pos: [0.2, 1.2, -10.4], target: [0, 0.6, 0] },
  rear: { pos: [-9.2, 1.75, 2.6], target: [-0.35, 0.6, 0] },
};

export const INTERIOR_EYE = [-0.30, 1.10, -0.36]; // driver (left) seat
