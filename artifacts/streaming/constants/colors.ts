export type ThemePalette = {
  id: string;
  name: string;
  bgImage: any;
  text: string;
  tint: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  surface: string;
  surface2: string;
  hover: string;
  live: string;
  gold: string;
  goldDim: string;
  goldGlow: string;
  overlay: string;
  glass: string;
};

export const themes: Record<string, ThemePalette> = {
  default: {
    id: "default",
    name: "Classic ENTEC",
    bgImage: require("../assets/images/theme_default_bg.png"),
    text: "#FFFFFF",
    tint: "#FFFFFF",
    background: "#0F1115",
    foreground: "#FFFFFF",
    card: "#1D222B",
    cardForeground: "#FFFFFF",
    primary: "#FFFFFF",
    primaryForeground: "#0F1115",
    secondary: "#161A20",
    secondaryForeground: "#9AA3B2",
    muted: "#6B7280",
    mutedForeground: "#6B7280",
    accent: "#F4C542",
    accentForeground: "#0F1115",
    destructive: "#FF3B30",
    destructiveForeground: "#FFFFFF",
    border: "#313845",
    input: "#161A20",
    surface: "#161A20",
    surface2: "#1D222B",
    hover: "#252B36",
    live: "#FF3B30",
    gold: "#F4C542",
    goldDim: "rgba(244,197,66,0.12)",
    goldGlow: "rgba(244,197,66,0.3)",
    overlay: "rgba(15,17,21,0.85)",
    glass: "rgba(22,27,37,0.72)",
  },
  ocean: {
    id: "ocean",
    name: "Ocean Abyss",
    bgImage: require("../assets/images/theme_ocean_bg.png"),
    text: "#FFFFFF",
    tint: "#FFFFFF",
    background: "#070E1A",
    foreground: "#FFFFFF",
    card: "#0C172A",
    cardForeground: "#FFFFFF",
    primary: "#FFFFFF",
    primaryForeground: "#070E1A",
    secondary: "#0F1D36",
    secondaryForeground: "#8FA3C2",
    muted: "#5B6C8A",
    mutedForeground: "#5B6C8A",
    accent: "#00E5FF",
    accentForeground: "#070E1A",
    destructive: "#FF3B30",
    destructiveForeground: "#FFFFFF",
    border: "#1E304D",
    input: "#0F1D36",
    surface: "#0F1D36",
    surface2: "#0C172A",
    hover: "#1A2C49",
    live: "#FF3B30",
    gold: "#00E5FF", 
    goldDim: "rgba(0,229,255,0.12)",
    goldGlow: "rgba(0,229,255,0.3)",
    overlay: "rgba(7,14,26,0.85)",
    glass: "rgba(12,23,42,0.72)",
  },
  crimson: {
    id: "crimson",
    name: "Crimson Silk",
    bgImage: require("../assets/images/theme_crimson_bg.png"),
    text: "#FFFFFF",
    tint: "#FFFFFF",
    background: "#160707",
    foreground: "#FFFFFF",
    card: "#260F0F",
    cardForeground: "#FFFFFF",
    primary: "#FFFFFF",
    primaryForeground: "#160707",
    secondary: "#1F0A0A",
    secondaryForeground: "#C28F8F",
    muted: "#8A5B5B",
    mutedForeground: "#8A5B5B",
    accent: "#FF4D4D",
    accentForeground: "#160707",
    destructive: "#FF3B30",
    destructiveForeground: "#FFFFFF",
    border: "#4D1E1E",
    input: "#1F0A0A",
    surface: "#1F0A0A",
    surface2: "#260F0F",
    hover: "#331414",
    live: "#FF3B30",
    gold: "#FF4D4D", 
    goldDim: "rgba(255,77,77,0.12)",
    goldGlow: "rgba(255,77,77,0.3)",
    overlay: "rgba(22,7,7,0.85)",
    glass: "rgba(38,15,15,0.72)",
  },
  forest: {
    id: "forest",
    name: "Emerald Forest",
    bgImage: require("../assets/images/theme_forest_bg.png"),
    text: "#FFFFFF",
    tint: "#FFFFFF",
    background: "#07160B",
    foreground: "#FFFFFF",
    card: "#0E2413",
    cardForeground: "#FFFFFF",
    primary: "#FFFFFF",
    primaryForeground: "#07160B",
    secondary: "#0A1B0E",
    secondaryForeground: "#8FC29C",
    muted: "#5B8A65",
    mutedForeground: "#5B8A65",
    accent: "#4DFF88",
    accentForeground: "#07160B",
    destructive: "#FF3B30",
    destructiveForeground: "#FFFFFF",
    border: "#1E4D2B",
    input: "#0A1B0E",
    surface: "#0A1B0E",
    surface2: "#0E2413",
    hover: "#132D19",
    live: "#FF3B30",
    gold: "#4DFF88", 
    goldDim: "rgba(77,255,136,0.12)",
    goldGlow: "rgba(77,255,136,0.3)",
    overlay: "rgba(7,22,11,0.85)",
    glass: "rgba(14,36,19,0.72)",
  },
  light: {
    id: "light",
    name: "Pure Light",
    bgImage: null, // No image, just clean background
    text: "#0F1115",
    tint: "#0F1115",
    background: "#F8F9FA",
    foreground: "#0F1115",
    card: "#FFFFFF",
    cardForeground: "#0F1115",
    primary: "#0F1115",
    primaryForeground: "#FFFFFF",
    secondary: "#E9ECEF",
    secondaryForeground: "#495057",
    muted: "#ADB5BD",
    mutedForeground: "#6C757D",
    accent: "#212529",
    accentForeground: "#FFFFFF",
    destructive: "#DC3545",
    destructiveForeground: "#FFFFFF",
    border: "#DEE2E6",
    input: "#E9ECEF",
    surface: "#E9ECEF",
    surface2: "#F1F3F5",
    hover: "#CED4DA",
    live: "#DC3545",
    gold: "#D4A017", 
    goldDim: "rgba(212,160,23,0.12)",
    goldGlow: "rgba(212,160,23,0.3)",
    overlay: "rgba(248,249,250,0.85)",
    glass: "rgba(255,255,255,0.72)",
  },
};

const colors = {
  light: themes.light,
  radius: 18,
};

export default colors;
