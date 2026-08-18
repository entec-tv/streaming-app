import React, { useState, useRef, useCallback, forwardRef } from 'react';
import { Pressable, Animated, ViewStyle, PressableProps, Platform, StyleProp } from 'react-native';
import { useColors } from '@/hooks/useColors';

export interface TVFocusableProps extends Omit<PressableProps, 'style' | 'children'> {
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
  children?: React.ReactNode | ((props: { focused: boolean; pressed: boolean }) => React.ReactNode);
  style?: StyleProp<ViewStyle> | ((props: { focused: boolean; pressed: boolean }) => StyleProp<ViewStyle>);
  scaleAmount?: number;
  borderThickness?: number;
  focusedBorderColor?: string;
  disableBorder?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const TVFocusable = forwardRef<any, TVFocusableProps>(({ 
  children, 
  style, 
  scaleAmount = 1.05,
  borderThickness = 4,
  focusedBorderColor,
  disableBorder = false,
  onFocus,
  onBlur,
  onPressIn,
  onPressOut,
  pointerEvents,
  ...props 
}, ref) => {
  const colors = useColors();
  const [isFocused, setIsFocused] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const domRef = useRef<HTMLElement>(null);

  const isTV = Platform.isTV;

  React.useEffect(() => {
    if (Platform.OS === 'web' && (props.hasTVPreferredFocus || (props as any).autoFocus)) {
      // Small timeout to allow the element to fully mount and paint
      const timer = setTimeout(() => {
        if (domRef.current) {
          domRef.current.focus({ preventScroll: true });
        } else if ((ref as any)?.current) {
          (ref as any).current.focus({ preventScroll: true });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [props.hasTVPreferredFocus, (props as any).autoFocus]);

  const handleFocus = useCallback((e: any) => {
    setIsFocused(true);
    Animated.spring(scaleAnim, { toValue: scaleAmount, useNativeDriver: true }).start();
    if (onFocus) onFocus(e);
  }, [scaleAnim, scaleAmount, onFocus]);

  const handleBlur = useCallback((e: any) => {
    setIsFocused(false);
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    if (onBlur) onBlur(e);
  }, [scaleAnim, onBlur]);

  const handlePressIn = useCallback((e: any) => {
    setIsPressed(true);
    Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start();
    if (onPressIn) onPressIn(e);
  }, [scaleAnim, onPressIn]);

  const handlePressOut = useCallback((e: any) => {
    setIsPressed(false);
    Animated.spring(scaleAnim, { toValue: isFocused ? scaleAmount : 1, useNativeDriver: true }).start();
    if (onPressOut) onPressOut(e);
  }, [scaleAnim, isFocused, scaleAmount, onPressOut]);

  const resolvedStyle = typeof style === 'function' ? style({ focused: isFocused, pressed: isPressed }) : style;
  
  const animatedStyle = {
    transform: [{ scale: scaleAnim }],
    ...( !disableBorder ? {
      borderWidth: borderThickness,
      borderColor: isFocused ? (focusedBorderColor || colors.gold) : 'transparent',
    } : {})
  };

  return (
    <AnimatedPressable
      ref={(node: any) => {
        (domRef as any).current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as any).current = node;
      }}
      {...props}
      {...(Platform.OS === 'web' && props.focusable !== false ? { tabIndex: 0 } : {})}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[resolvedStyle, animatedStyle]}
      pointerEvents={pointerEvents}
    >
      {typeof children === 'function' ? children({ focused: isFocused, pressed: isPressed }) : children}
    </AnimatedPressable>
  );
});
