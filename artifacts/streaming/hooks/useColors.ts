import { useMemo } from "react";
import { useColorScheme } from "react-native";
import { themes } from "@/constants/colors";
import { useAppStore } from "@/store/app-store";

/**
 * Returns the design tokens for the current theme.
 * Reads the currentThemeId from the global Zustand store.
 */
export function useColors() {
  const currentThemeId = useAppStore(s => s.currentThemeId);
  
  return useMemo(() => {
    const theme = themes[currentThemeId] || themes.default;
    return { ...theme, radius: 18 };
  }, [currentThemeId]);
}
