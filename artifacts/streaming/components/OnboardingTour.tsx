import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Platform, useWindowDimensions, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { TVFocusable } from '@/components/TVFocusable';

interface OnboardingStep {
  id: string;
  targetId?: string;
  title: { en: string; ar: string };
  description: { en: string; ar: string };
  icon?: any;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  isFullScreen?: boolean;
  route?: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    route: '/',
    title: { en: 'Welcome to EN-TEC! 🎬', ar: 'مرحباً بك في EN-TEC! 🎬' },
    description: { en: 'Your ultimate app for Live TV, Movies, and Series. Let us show you around!', ar: 'تطبيقك الشامل للبث المباشر والأفلام والمسلسلات. دعنا نأخذك في جولة سريعة!' },
    isFullScreen: true,
  },
  {
    id: 'sidebar',
    route: '/',
    targetId: 'tour-sidebar-nav',
    title: { en: 'Main Menu', ar: 'القائمة الرئيسية' },
    description: { en: 'Navigate between Home, Live TV, Movies, Series, and more from here.', ar: 'تنقل بين الأقسام: الرئيسية، البث المباشر، الأفلام، المسلسلات والمزيد من هنا.' },
    icon: 'menu-outline',
    position: 'right',
  },
  {
    id: 'live',
    route: '/(tabs)/live',
    targetId: 'tour-live-categories',
    title: { en: 'Live TV Channels', ar: 'قنوات البث المباشر' },
    description: { en: 'Browse thousands of live channels across different categories and countries.', ar: 'تصفح آلاف القنوات المباشرة عبر مختلف التصنيفات والبلدان.' },
    icon: 'tv-outline',
    position: 'bottom',
  },
  {
    id: 'movies',
    route: '/(tabs)/movies',
    targetId: 'tour-movies-grid',
    title: { en: 'Movies & Series', ar: 'الأفلام والمسلسلات' },
    description: { en: 'Enjoy a huge library of VOD content with full details, trailers, and actor info.', ar: 'استمتع بمكتبة ضخمة من الأفلام والمسلسلات مع تفاصيل كاملة ومقاطع دعائية ومعلومات الممثلين.' },
    icon: 'film-outline',
    position: 'top',
  },
  {
    id: 'catchup',
    route: '/(tabs)/catchup',
    targetId: 'tour-catchup-list',
    title: { en: 'Catch Up', ar: 'إعادة البث' },
    description: { en: 'Missed a show? Watch past broadcasts from supported channels.', ar: 'فاتك برنامج؟ شاهد البث السابق للقنوات المدعومة.' },
    icon: 'play-back-outline',
    position: 'top',
  },
  {
    id: 'recent',
    route: '/',
    targetId: 'tour-continue-watching',
    title: { en: 'Continue Watching', ar: 'أكمل المشاهدة' },
    description: { en: 'Pick up exactly where you left off. Your watch progress is saved automatically.', ar: 'سيظهر هنا ما توقفت عنده لتكمل من حيث بدأت. يتم حفظ تقدمك تلقائياً.' },
    icon: 'time-outline',
    position: 'top',
  },
  {
    id: 'search',
    route: '/',
    targetId: 'tour-search-btn',
    title: { en: 'Quick Search', ar: 'البحث السريع' },
    description: { en: 'Instantly find any channel, movie, or series from your playlists.', ar: 'ابحث فوراً في آلاف القنوات والأفلام والمسلسلات من قوائم التشغيل.' },
    icon: 'search-outline',
    position: 'bottom',
  },
  {
    id: 'finish',
    route: '/',
    title: { en: 'You are all set! 🚀', ar: 'أنت جاهز! 🚀' },
    description: { en: 'Enjoy watching! You can restart this tour anytime from the Playlists page.', ar: 'استمتع بالمشاهدة! يمكنك إعادة الجولة في أي وقت من صفحة قوائم التشغيل.' },
    isFullScreen: true,
  }
];

interface Props {
  onComplete: () => void;
}

export function OnboardingTour({ onComplete }: Props) {
  const colors = useColors();
  const { language, isRTL } = useTranslation();
  const { width, height } = useWindowDimensions();
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isSmallScreen = width < 600;
  const isMediumScreen = width >= 600 && width < 1024;

  const lang = (language === 'ar' ? 'ar' : 'en') as 'en' | 'ar';
  const step = ONBOARDING_STEPS[currentStep];

  // Card width responsive
  const cardWidth = isSmallScreen ? width - 40 : isMediumScreen ? 380 : 420;

  useEffect(() => {
    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();

    // Navigate if needed
    if (step.route) {
      try {
        router.replace(step.route as any);
      } catch (e) {
        // Ignore navigation errors during tour
      }
    }

    // Measure target element if not full screen
    if (!step.isFullScreen && step.targetId && Platform.OS === 'web') {
      let attempts = 0;
      let found = false;
      let cancelled = false;
      
      const checkElement = () => {
        if (cancelled || attempts > 30) {
          if (!cancelled) setTargetRect(null);
          return;
        }
        attempts++;
        const el = document.getElementById(step.targetId!);
        
        if (el) {
          const currentRect = el.getBoundingClientRect();
          if (currentRect.width > 0 && currentRect.height > 0) {
            el.scrollIntoView({ behavior: 'auto', block: 'center' });
            setTimeout(() => {
              if (cancelled) return;
              const finalRect = el.getBoundingClientRect();
              setTargetRect({
                x: finalRect.left,
                y: finalRect.top,
                w: finalRect.width,
                h: finalRect.height,
              });
            }, 150);
            return; // Successfully found and measured, exit polling
          }
        }
        
        // If not found, or found but hidden (width/height 0), keep polling
        setTimeout(checkElement, 150);
      };
      
      setTimeout(checkElement, 200);
      return () => { cancelled = true; };
    } else {
      setTargetRect(null);
    }
  }, [currentStep]);

  const handleNext = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start(() => {
      if (currentStep < ONBOARDING_STEPS.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        onComplete();
      }
    });
  }, [currentStep, onComplete]);

  const handleSkip = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start(() => {
      // Navigate back to home before completing
      try { router.replace('/(tabs)'); } catch (e) {}
      onComplete();
    });
  }, [onComplete]);

  const renderSpotlight = () => {
    if (!targetRect || step.isFullScreen) return null;

    const padding = 12;
    const sX = targetRect.x - padding;
    const sY = targetRect.y - padding;
    const sW = targetRect.w + padding * 2;
    const sH = targetRect.h + padding * 2;

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Top mask */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.max(0, sY), backgroundColor: 'rgba(0,0,0,0.82)' }} />
        {/* Bottom mask */}
        <View style={{ position: 'absolute', top: sY + sH, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.82)' }} />
        {/* Left mask */}
        <View style={{ position: 'absolute', top: sY, left: 0, width: Math.max(0, sX), height: sH, backgroundColor: 'rgba(0,0,0,0.82)' }} />
        {/* Right mask */}
        <View style={{ position: 'absolute', top: sY, left: sX + sW, right: 0, height: sH, backgroundColor: 'rgba(0,0,0,0.82)' }} />
        
        {/* Spotlight cutout border */}
        <View style={{ position: 'absolute', top: sY, left: sX, width: sW, height: sH, borderWidth: 2, borderColor: colors.gold, borderRadius: 12 }} />
      </View>
    );
  };

  const getTooltipPosition = () => {
    let top: any = 'auto';
    let left: any = 'auto';

    if (step.isFullScreen || !targetRect) {
      // Center on screen
      top = Math.max(20, (height - 250) / 2);
      left = Math.max(20, (width - cardWidth) / 2);
    } else {
      const padding = 12;
      const sX = targetRect.x - padding;
      const sY = targetRect.y - padding;
      const sW = targetRect.w + padding * 2;
      const sH = targetRect.h + padding * 2;
      const cardHeight = 220;
      const gap = 16;

      if (isSmallScreen) {
        // On small screens always put tooltip at bottom of viewport
        left = 20;
        top = height - cardHeight - 20;
      } else if (step.position === 'right') {
        left = sX + sW + gap;
        top = sY + (sH / 2) - (cardHeight / 2);
      } else if (step.position === 'bottom') {
        top = sY + sH + gap;
        left = sX + (sW / 2) - (cardWidth / 2);
      } else if (step.position === 'top') {
        top = sY - gap - cardHeight;
        left = sX + (sW / 2) - (cardWidth / 2);
      } else if (step.position === 'left') {
        left = sX - gap - cardWidth;
        top = sY + (sH / 2) - (cardHeight / 2);
      }

      // Constrain to screen edges
      if (left !== 'auto' && typeof left === 'number') {
        if (left + cardWidth > width - 20) left = width - cardWidth - 20;
        if (left < 20) left = 20;
      }
      if (top !== 'auto' && typeof top === 'number') {
        if (top + cardHeight > height - 20) top = height - cardHeight - 20;
        if (top < 20) top = 20;
      }
    }

    return { top, left };
  };

  const tooltipPos = getTooltipPosition();

  return (
    <Modal transparent visible={true} animationType="none">
      <View style={styles.container}>
        {(step.isFullScreen || !targetRect) ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)' }]} />
        ) : (
          renderSpotlight()
        )}

        <Animated.View style={[
          styles.tooltipCard, 
          { 
            ...tooltipPos,
            width: cardWidth,
            opacity: fadeAnim, 
            backgroundColor: 'rgba(20, 25, 35, 0.96)', 
            borderColor: colors.gold, 
            borderWidth: 1,
            direction: isRTL ? 'rtl' : 'ltr',
          }
        ]}>
          {/* Step indicator + icon header */}
          <View style={[styles.cardHeader, isRTL && { flexDirection: 'row-reverse' }]}>
            <View style={[styles.stepIndicator, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={styles.stepIndicatorText}>
                {currentStep + 1} / {ONBOARDING_STEPS.length}
              </Text>
            </View>
            {step.icon && (
              <View style={[styles.iconCircle, { backgroundColor: `${colors.gold}20`, borderColor: `${colors.gold}40` }]}>
                <Ionicons name={step.icon} size={22} color={colors.gold} />
              </View>
            )}
          </View>
          
          <Text style={[
            styles.title, 
            { textAlign: isRTL ? 'right' : 'left' },
          ]}>
            {step.title[lang]}
          </Text>
          <Text style={[
            styles.description, 
            { textAlign: isRTL ? 'right' : 'left' },
          ]}>
            {step.description[lang]}
          </Text>

          {/* Progress dots + actions */}
          <View style={[styles.footer, isRTL && { flexDirection: 'row-reverse' }]}>
            <View style={[styles.dots, isRTL && { flexDirection: 'row-reverse' }]}>
              {ONBOARDING_STEPS.map((_, i) => (
                <View 
                  key={i} 
                  style={[
                    styles.dot, 
                    i === currentStep && { backgroundColor: colors.gold, width: 20 },
                    i < currentStep && { backgroundColor: `${colors.gold}60` }
                  ]} 
                />
              ))}
            </View>

            <View style={[styles.actions, isRTL && { flexDirection: 'row-reverse' }]}>
              <TVFocusable onPress={handleSkip} style={styles.skipBtn} disableBorder>
                <Text style={styles.skipText}>{isRTL ? 'تخطي' : 'Skip'}</Text>
              </TVFocusable>
              <TVFocusable 
                onPress={handleNext} 
                style={[styles.nextBtn, { backgroundColor: colors.gold }]}
                focusedBorderColor={colors.gold}
              >
                <Text style={styles.nextText}>
                  {isRTL 
                    ? (currentStep === ONBOARDING_STEPS.length - 1 ? 'إنهاء' : 'التالي') 
                    : (currentStep === ONBOARDING_STEPS.length - 1 ? 'Finish' : 'Next')}
                </Text>
                {currentStep < ONBOARDING_STEPS.length - 1 && (
                  <Ionicons 
                    name={isRTL ? "chevron-back" : "chevron-forward"} 
                    size={16} 
                    color="#000" 
                    style={{ marginLeft: isRTL ? 0 : 4, marginRight: isRTL ? 4 : 0 }} 
                  />
                )}
              </TVFocusable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tooltipCard: {
    position: 'absolute',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepIndicator: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stepIndicatorText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  description: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  skipText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '600',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  nextText: {
    color: '#000',
    fontSize: 15,
    fontWeight: 'bold',
  }
});
