import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, useWindowDimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/hooks/useTranslation';

interface StartupPreloaderProps {
  progress: number; // 0 to 100
  statusMessage?: string;
  playlistName?: string;
}

export function StartupPreloader({
  progress,
  statusMessage = 'جاري مزامنة المحتوى...',
  playlistName,
}: StartupPreloaderProps) {
  const { width, height } = useWindowDimensions();
  const { t, isRTL } = useTranslation();
  const isCompact = width < 700 || height < 500;

  const animatedProgress = useRef(new Animated.Value(progress)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: Math.max(0, Math.min(100, progress)),
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [progress, animatedProgress]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const progressWidth = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const milestones = [
    { key: 'verify', label: 'التحقق', icon: 'shield-checkmark', threshold: 15 },
    { key: 'categories', label: 'الفئات', icon: 'folder', threshold: 35 },
    { key: 'live', label: 'البث المباشر', icon: 'tv', threshold: 60 },
    { key: 'vod', label: 'المكتبة', icon: 'film', threshold: 85 },
  ];

  return (
    <View style={styles.container}>
      {/* Background Gradients */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={['rgba(212,168,67,0.18)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: -200, left: -200, width: 600, height: 600, borderRadius: 300 }}
        />
        <LinearGradient
          colors={['rgba(33,70,140,0.22)', 'transparent']}
          start={{ x: 1, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={{ position: 'absolute', bottom: -200, right: -200, width: 600, height: 600, borderRadius: 300 }}
        />
      </View>

      <View style={styles.content}>
        {/* Branding Logo with Pulsing Glow */}
        <Animated.View style={[styles.logoContainer, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.logoBadge}>
            <Ionicons name="tv-outline" size={isCompact ? 32 : 46} color="#F4C542" />
          </View>
        </Animated.View>

        <View style={styles.titleRow}>
          <Text style={styles.brandTitle}>EN<Text style={{ color: '#FFF' }}>-TEC</Text></Text>
          <Text style={styles.brandSubtitle}>STREAMING</Text>
        </View>

        {/* Central Progress Box */}
        <View style={[styles.progressCard, isCompact && styles.progressCardCompact]}>
          <View style={styles.progressHeader}>
            <Text style={styles.statusText} numberOfLines={1}>
              {statusMessage}
            </Text>
            <Text style={styles.percentageText}>
              {Math.round(progress)}%
            </Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarTrack}>
            <Animated.View style={[styles.progressBarFill, { width: progressWidth }]}>
              <LinearGradient
                colors={['#C6922A', '#F4C542', '#FFF5D0']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>

          {/* Milestones Steps */}
          <View style={styles.milestonesRow}>
            {milestones.map((m) => {
              const isCompleted = progress >= m.threshold;
              const isCurrent = progress >= m.threshold - 20 && progress < m.threshold;
              return (
                <View key={m.key} style={styles.milestoneItem}>
                  <View
                    style={[
                      styles.milestoneIconBg,
                      isCompleted && styles.milestoneIconBgCompleted,
                      isCurrent && styles.milestoneIconBgCurrent,
                    ]}
                  >
                    <Ionicons
                      name={isCompleted ? 'checkmark' : (m.icon as any)}
                      size={14}
                      color={isCompleted ? '#1A1A1A' : isCurrent ? '#F4C542' : 'rgba(255,255,255,0.3)'}
                    />
                  </View>
                  <Text
                    style={[
                      styles.milestoneText,
                      isCompleted && styles.milestoneTextCompleted,
                      isCurrent && styles.milestoneTextCurrent,
                    ]}
                  >
                    {m.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <Text style={styles.hintText}>
          يتم تجهيز القنوات والمحتوى للتشغيل الفوري السريع بدون انتظار
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#05070a',
    zIndex: 99999,
    elevation: 99999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 680,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212,168,67,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(212,168,67,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F4C542',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  titleRow: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#F4C542',
    letterSpacing: 2,
  },
  brandSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 8,
    marginTop: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  progressCard: {
    width: '100%',
    backgroundColor: 'rgba(18, 22, 30, 0.85)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.25)',
    padding: 24,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 8,
  },
  progressCardCompact: {
    padding: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statusText: {
    color: '#E0E0E0',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  percentageText: {
    color: '#F4C542',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  progressBarTrack: {
    width: '100%',
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
    overflow: 'hidden',
  },
  milestonesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 4,
  },
  milestoneItem: {
    alignItems: 'center',
    gap: 6,
  },
  milestoneIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  milestoneIconBgCompleted: {
    backgroundColor: '#F4C542',
    borderColor: '#F4C542',
  },
  milestoneIconBgCurrent: {
    borderColor: '#F4C542',
    backgroundColor: 'rgba(212,168,67,0.15)',
  },
  milestoneText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  milestoneTextCompleted: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  milestoneTextCurrent: {
    color: '#F4C542',
    fontWeight: 'bold',
  },
  hintText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    marginTop: 20,
    textAlign: 'center',
  },
});
