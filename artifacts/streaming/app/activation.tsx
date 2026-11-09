import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, ScrollView, useWindowDimensions, Modal } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppStore } from '@/store/app-store';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TVFocusable } from '@/components/TVFocusable';
import { StartupPreloader } from '@/components/StartupPreloader';
import { PlatformLogos } from '@/components/PlatformLogos';
import * as Clipboard from 'expo-clipboard';

let SERVER_URL = 'https://streamingnest-production.up.railway.app/api';

const fetchWithTimeout = (url: string, options: any = {}, timeoutMs: number = 5000) => {
  return Promise.race([
    fetch(url, options),
    new Promise<Response>((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
  ]);
};

export default function ActivationScreen() {
  const colors = useColors();
  const { width, height } = useWindowDimensions();
  const isMobile = width < 860 && width < height;
  const isCompact = height < 680 || width < 1100;

  const deviceId = useAppStore(s => s.deviceId);
  const deviceKey = useAppStore(s => s.deviceKey);
  const login = useAppStore(s => s.login);
  const subscriptionExpired = useAppStore(s => s.subscriptionExpired);
  const isAppLocked = useAppStore(s => s.isAppLocked);
  const isTrialActive = useAppStore(s => s.isTrialActive);
  const trialDaysRemaining = useAppStore(s => s.trialDaysRemaining);
  const trialEndsAt = useAppStore(s => s.trialEndsAt);
  const showGlobalAlert = useAppStore(s => s.showGlobalAlert);
  const hideGlobalAlert = useAppStore(s => s.hideGlobalAlert);
  const refreshCounter = useAppStore(s => s.refreshCounter);

  const [loading, setLoading] = useState(false);
  const [copiedMac, setCopiedMac] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [preloadStatus, setPreloadStatus] = useState('');
  const [preloadPlaylistName, setPreloadPlaylistName] = useState('');

  // Store modal & plans state
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);

  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCheckingRef = useRef(false);

  const handleCopyMac = async () => {
    if (!deviceId) return;
    try {
      await Clipboard.setStringAsync(deviceId);
    } catch {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(deviceId);
      }
    }
    setCopiedMac(true);
    setTimeout(() => setCopiedMac(false), 2000);
  };

  const handleCopyKey = async () => {
    if (!deviceKey) return;
    try {
      await Clipboard.setStringAsync(deviceKey);
    } catch {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(deviceKey);
      }
    }
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const checkActivation = async () => {
    if (isCheckingRef.current || isPreloading) {
      return;
    }
    isCheckingRef.current = true;

    try {
      const currentDeviceId = deviceId || useAppStore.getState().deviceId;
      const currentDeviceKey = deviceKey || useAppStore.getState().deviceKey;

      if (!currentDeviceId || !currentDeviceKey) {
        return;
      }

      setLoading(true);

      const response = await fetchWithTimeout(`${SERVER_URL}/client/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          macAddress: currentDeviceId,
          deviceKey: currentDeviceKey,
          clientTime: new Date().toISOString(),
        }),
      });

      const data = await response.json().catch(() => null);

      if (data?.serverTime) {
        const sTime = Date.parse(data.serverTime);
        if (!isNaN(sTime)) {
          useAppStore.setState({ serverTime: data.serverTime, serverTimeOffset: sTime - Date.now() });
        }
      }

      if (response.status === 403 && data && (data.error === 'trial_expired' || data.isAppLocked)) {
        useAppStore.setState({
          isAppLocked: true,
          subscriptionExpired: true,
          isTrialActive: false,
          trialDaysRemaining: 0,
          trialEndsAt: data.trial?.trialEndsAt || data.trialEndsAt || null,
        });
        return;
      }

      if (data?.trial) {
        useAppStore.setState({
          isTrialActive: data.trial.isTrialActive,
          trialDaysRemaining: data.trial.daysRemaining ?? data.trial.trialDaysRemaining ?? 0,
          trialHoursRemaining: data.trial.hoursRemaining ?? 0,
          trialEndsAt: data.trial.trialEndsAt || null,
          isAppLocked: data.isAppLocked === true,
          subscriptionExpired: data.isAppLocked === true,
        });
      }

      if (response.ok && data?.token && !data.isAppLocked) {
        if (pollInterval.current) {
          clearInterval(pollInterval.current);
          pollInterval.current = null;
        }

        setIsPreloading(true);
        setPreloadProgress(15);
        setPreloadStatus('Subscription verified successfully!');

        if (data.customer?.subscriptions) {
          await useAppStore.getState().syncAdminSubscriptions(data.customer.subscriptions);
        }
        useAppStore.getState().setSubscriptionExpired(false);

        let currentActiveId = useAppStore.getState().activePlaylistId;
        const currentPlaylists = useAppStore.getState().playlists;
        if ((!currentActiveId || ['p1', 'p2', 'p3'].includes(currentActiveId) || !currentPlaylists.some(p => p.id === currentActiveId)) && currentPlaylists.length > 0) {
          currentActiveId = currentPlaylists[0].id;
          await useAppStore.getState().setActivePlaylist(currentActiveId);
        }
        const currentPlaylist = currentPlaylists.find(p => p.id === currentActiveId);

        if (currentActiveId) {
          setPreloadPlaylistName(currentPlaylist?.name || '');
          await useAppStore.getState().preloadFullPlaylistContent(currentActiveId, (percent, msg) => {
            setPreloadProgress(percent);
            setPreloadStatus(msg);
          });
        } else {
          setPreloadProgress(100);
          setPreloadStatus('Activation complete');
        }

        login(data.token, data.customer);
        router.replace('/(tabs)');
      }
    } catch (err) {
      console.warn('Activation check error:', err);
    } finally {
      isCheckingRef.current = false;
      setLoading(false);
    }
  };

  const handleDemoMode = async () => {
    if (isAppLocked || (!isTrialActive && subscriptionExpired)) {
      showGlobalAlert(
        'انتهت الفترة التجريبية (Trial Expired)',
        'انتهت الفترة التجريبية المجانية الخاصة بهذا الجهاز (7 أيام).\nيرجى زيارة المتجر أو الموقع لشراء ترخيص للاستمرار في استخدام التطبيق.',
        'شراء اشتراك (Store)',
        () => {
          hideGlobalAlert();
          setIsStoreOpen(true);
        },
        {
          text: 'إغلاق (Close)',
          onPress: () => hideGlobalAlert(),
        }
      );
      return;
    }

    const demoPlaylist = {
      id: 'p1',
      name: 'EN-TEC Demo Experience',
      url: 'demo://main',
      channels: 16881,
      updated: 'Demo Active',
      lastUpdatedTimestamp: Date.now(),
      isDemo: true,
    };
    useAppStore.setState({
      isLoggedIn: true,
      user: { token: 'demo_token', name: 'Demo Experience', plan: 'Demo Mode' } as any,
      playlists: [demoPlaylist],
      activePlaylistId: 'p1',
      subscriptionExpired: false,
      isAppLocked: false,
    });
    await useAppStore.getState().setActivePlaylist('p1');
    router.replace('/(tabs)');
  };

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await fetchWithTimeout(`${SERVER_URL}/plans`, {}, 4000);
        if (res.ok) {
          const data = await res.json();
          if (data.plans && data.plans.length > 0) {
            setPlans(data.plans);
          }
        }
      } catch {}
    };
    fetchPlans();
  }, []);

  useEffect(() => {
    const currentDeviceId = deviceId || useAppStore.getState().deviceId;
    if (!subscriptionExpired && currentDeviceId) {
      checkActivation();

      pollInterval.current = setInterval(() => {
        checkActivation();
      }, 10000);
    }

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [subscriptionExpired, deviceId, deviceKey]);

  useEffect(() => {
    if (refreshCounter > 0) {
      checkActivation();
    }
  }, [refreshCounter]);

  if (isPreloading) {
    return (
      <StartupPreloader
        progress={preloadProgress}
        statusMessage={preloadStatus}
      />
    );
  }

  const defaultPlans = [
    {
      _id: 'plan_1',
      name: '1 Month Pass',
      price: '$9.99',
      duration: '1 Month',
      isPopular: false,
      features: ['Full 4K / FHD Access', 'Single Device License', 'Instant Activation', '24/7 Updates'],
    },
    {
      _id: 'plan_2',
      name: '6 Months Pass',
      price: '$39.99',
      duration: '6 Months',
      isPopular: true,
      features: ['All 1-Month Features', 'Priority High-Speed Servers', 'Multi-Device Support', 'VIP Maintenance'],
    },
    {
      _id: 'plan_3',
      name: '12 Months VIP',
      price: '$69.99',
      duration: '12 Months',
      isPopular: false,
      isBestValue: true,
      features: ['Full Unrestricted Access', 'Ultra-Low Latency CDN', '24/7 Dedicated Support', 'Maximum Savings'],
    },
  ];

  const activePlansToDisplay = plans.length > 0 ? plans : defaultPlans;

  // Render Store Modal
  const renderStoreModal = () => (
    <Modal
      visible={isStoreOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setIsStoreOpen(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderIconBg}>
              <Ionicons name="cart-outline" size={24} color="#F4C542" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Subscription Store</Text>
              <Text style={styles.modalSubtitle}>
                Select a plan or send your device credentials to technical support
              </Text>
            </View>
            <TVFocusable
              onPress={() => setIsStoreOpen(false)}
              style={({ focused }: any) => [
                styles.modalCloseBtn,
                focused && { backgroundColor: '#F4C542', borderColor: '#FFF' },
              ]}
            >
              {({ focused }: any) => (
                <Ionicons name="close" size={20} color={focused ? '#000' : '#FFF'} />
              )}
            </TVFocusable>
          </View>

          {/* Plans Row */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.modalPlansContainer}
          >
            {activePlansToDisplay.map((p, idx) => (
              <View
                key={p._id || idx}
                style={[
                  styles.planBox,
                  p.isPopular && styles.planBoxPopular,
                ]}
              >
                {p.isPopular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>POPULAR</Text>
                  </View>
                )}
                {p.isBestValue && (
                  <View style={[styles.popularBadge, { backgroundColor: '#22C55E' }]}>
                    <Text style={styles.popularBadgeText}>BEST VALUE</Text>
                  </View>
                )}
                <Text style={styles.planName}>{p.name}</Text>
                <Text style={styles.planPrice}>
                  {typeof p.price === 'number' ? `$${p.price}` : p.price}
                </Text>
                <Text style={styles.planDuration}>{p.duration || 'Access Pass'}</Text>
                <View style={styles.planDivider} />
                <View style={{ gap: 8, marginTop: 4 }}>
                  {(p.features || []).map((feat: string, fIdx: number) => (
                    <View key={fIdx} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="checkmark-circle" size={14} color="#F4C542" />
                      <Text style={styles.planFeatureText}>{feat}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Device Credentials Reminder */}
          <View style={styles.modalFooterInfo}>
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="globe-outline" size={16} color="#F4C542" />
                <Text style={styles.modalFooterText}>
                  Portal: <Text style={{ color: '#F4C542', fontWeight: 'bold' }}>https://subscription.entec.store</Text>
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="information-circle-outline" size={16} color="#F4C542" />
                <Text style={styles.modalFooterText}>
                  MAC: <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{deviceId || '...'}</Text>
                  {'   '}|{'   '}
                  Key: <Text style={{ color: '#F4C542', fontWeight: 'bold' }}>{deviceKey || '...'}</Text>
                </Text>
              </View>
            </View>
            <TVFocusable
              onPress={() => setIsStoreOpen(false)}
              style={({ focused }: any) => [
                styles.modalDismissBtn,
                focused && { backgroundColor: '#F4C542', borderColor: '#FFF', transform: [{ scale: 1.05 }] },
              ]}
            >
              {({ focused }: any) => (
                <Text style={[styles.modalDismissBtnText, { color: focused ? '#000' : '#FFF' }]}>
                  Done
                </Text>
              )}
            </TVFocusable>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Left Section (Brand & Info)
  const renderLeftSection = () => (
    <View style={[styles.leftContentWrapper, isCompact && styles.leftContentWrapperCompact]}>
      {/* Pure Text Logo - Just Letters without colored boxes */}
      <View style={styles.brandLettersWrapper}>
        <Text style={[styles.brandTitleText, isCompact && { fontSize: 38 }]}>
          <Text style={{ color: '#F4C542' }}>EN-</Text>
          <Text style={{ color: '#FFFFFF' }}>TEC</Text>
        </Text>
        <Text style={styles.brandSubtitleText}>STREAMING</Text>
      </View>

      {/* Main Title & Description */}
      <Text style={[styles.headlineText, isCompact && { fontSize: 18, marginTop: 16 }]}>
        Experience, Entertainment Redefined
      </Text>
      
      <Text style={[styles.descriptionText, isCompact && { fontSize: 11, lineHeight: 16, marginTop: 8 }]}>
        Stream an extensive collection of movies, series, and live TV (Qunwat Mubashara) on any device, designed for your ultimate viewing pleasure.
      </Text>
      
      <Text style={[styles.descriptionText, isCompact && { fontSize: 11, lineHeight: 16, marginTop: 6 }]}>
        Elevate your experience with customizable playlists and secure parental controls (Ruqaba Abawiya Amena).
      </Text>

      {/* Available on Section */}
      <Text style={[styles.availableOnTitle, isCompact && { marginTop: 14, marginBottom: 8 }]}>
        Available on:
      </Text>
      
      <PlatformLogos isCompact={isCompact} />

      {/* Trial period notice */}
      {isAppLocked || (!isTrialActive && subscriptionExpired) ? (
        <View style={[styles.trialNoticeBox, { borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.12)' }, isCompact && { marginTop: 12, paddingVertical: 6 }]}>
          <Ionicons name="lock-closed" size={isCompact ? 14 : 16} color="#EF4444" />
          <Text style={[styles.trialNoticeText, { color: '#EF4444' }, isCompact && { fontSize: 11 }]}>
            Trial expired: Your 7-day complimentary trial has ended.
          </Text>
        </View>
      ) : (
        <View style={[styles.trialNoticeBox, isCompact && { marginTop: 12, paddingVertical: 6 }]}>
          <Ionicons name="time-outline" size={isCompact ? 14 : 16} color="#F4C542" />
          <Text style={[styles.trialNoticeText, isCompact && { fontSize: 11 }]}>
            Trial period notice your complimentary trial ends in{' '}
            <Text style={{ color: trialDaysRemaining <= 1 ? '#EF4444' : '#F4C542', fontWeight: 'bold' }}>
              {trialDaysRemaining > 1
                ? `${trialDaysRemaining} Days`
                : trialDaysRemaining === 1
                ? '1 Day'
                : 'Today'}
            </Text>
          </Text>
        </View>
      )}

      {/* Thank you sentence with Checkmark (as requested: وضع علامة صح بجانب جملة الشكر) */}
      <View style={styles.thankYouRow}>
        <Ionicons name="checkmark-circle" size={isCompact ? 16 : 18} color="#22C55E" />
        <Text style={[styles.thankYouText, isCompact && { fontSize: 12 }]}>
          Thank you for choosing us to bring your entertainment to life.
        </Text>
      </View>
    </View>
  );

  // Right Section (Calm Dark Luxury Panel with Gold Accents)
  const renderRightSection = () => (
    <LinearGradient
      colors={['#10141F', '#151B28', '#0C0F17']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.35, y: 1 }}
      style={[styles.rightGoldPanel, isCompact && styles.rightGoldPanelCompact]}
    >
      <View style={styles.rightContentContainer}>
        {/* Title */}
        <Text style={[styles.goldHeaderTitle, isCompact && { fontSize: 20 }]}>
          {isAppLocked ? 'Subscription Required' : 'To Continue Using The App'}
        </Text>
        
        {/* Subtitle */}
        <Text style={[styles.goldSubtitle, isCompact && { fontSize: 11, lineHeight: 16 }]}>
          {isAppLocked
            ? 'Your complimentary trial has expired. To continue using the app, please purchase an activation pass or enter your playlist credentials.'
            : 'Press OK to explore our demo, or visit our website to add your own playlist.\nAfter your trial period, a license purchase will be required.'}
        </Text>

        {/* Adding Playlist Header */}
        <Text style={[styles.addingPlaylistTitle, isCompact && { marginVertical: 10, fontSize: 14 }]}>
          Adding Playlist:
        </Text>

        {/* Steps List */}
        <View style={[styles.stepsListContainer, isCompact && { gap: 10 }]}>
          {/* Step 1: Visit Website */}
          <View style={styles.stepRow}>
            <View style={styles.stepDarkIconBox}>
              <Ionicons name="globe-outline" size={18} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepText}>
                Visit <Text style={styles.stepLinkText}>https://subscription.entec.store</Text>
              </Text>
            </View>
          </View>

          {/* Step 2: Log in */}
          <View style={styles.stepRow}>
            <View style={styles.stepDarkIconBox}>
              <Ionicons name="arrow-forward-circle-outline" size={18} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepText}>
                Log in using your device's MAC Address and unique device key.
              </Text>
            </View>
          </View>

          {/* Step 3: MAC Address & Device Key with copy */}
          <View style={styles.stepRow}>
            <View style={styles.stepDarkIconBox}>
              <Ionicons name="lock-closed-outline" size={18} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepCredentialsLine}>
                Mac address: <Text style={styles.credentialsHighlight}>{deviceId || 'EB:EB:F6:F8:E1:E0'}</Text>
              </Text>
              <Text style={styles.stepCredentialsLine}>
                Device key: <Text style={styles.credentialsHighlight}>{deviceKey || '535406'}</Text>
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TVFocusable
                onPress={handleCopyMac}
                style={({ focused }: any) => [
                  styles.stepMiniCopyBtn,
                  focused && { backgroundColor: '#F4C542', borderColor: '#FFF' },
                ]}
              >
                {({ focused }: any) => (
                  <Ionicons
                    name={copiedMac ? 'checkmark-circle' : 'copy-outline'}
                    size={16}
                    color={focused ? '#000' : (copiedMac ? '#22C55E' : '#F4C542')}
                  />
                )}
              </TVFocusable>
              <TVFocusable
                onPress={handleCopyKey}
                style={({ focused }: any) => [
                  styles.stepMiniCopyBtn,
                  focused && { backgroundColor: '#F4C542', borderColor: '#FFF' },
                ]}
              >
                {({ focused }: any) => (
                  <Ionicons
                    name={copiedKey ? 'checkmark-circle' : 'key-outline'}
                    size={16}
                    color={focused ? '#000' : (copiedKey ? '#22C55E' : '#F4C542')}
                  />
                )}
              </TVFocusable>
            </View>
          </View>

          {/* Step 4: Add Playlist */}
          <View style={styles.stepRow}>
            <View style={styles.stepDarkIconBox}>
              <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepText}>
                Add your preferred playlist, then restart the app to enjoy your updates.
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom 3 Action Buttons: [ 🔄 ]  [ Demo ]  [ 🛒 ] */}
        <View style={[styles.bottomButtonsRow, isCompact && { marginTop: 14 }]}>
          {/* 1. Reload Button */}
          <TVFocusable
            onPress={checkActivation}
            style={({ focused }: any) => [
              styles.actionSquareButton,
              focused && styles.actionButtonFocused,
            ]}
          >
            {({ focused }: any) => (
              loading ? (
                <ActivityIndicator size="small" color={focused ? '#000' : '#FFF'} />
              ) : (
                <Ionicons name="refresh" size={22} color={focused ? '#000' : '#FFF'} />
              )
            )}
          </TVFocusable>

          {/* 2. Demo Button */}
          <TVFocusable
            onPress={handleDemoMode}
            style={({ focused }: any) => [
              styles.actionDemoButton,
              isAppLocked && { borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.15)' },
              focused && styles.actionButtonFocused,
            ]}
          >
            {({ focused }: any) => (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {isAppLocked && <Ionicons name="lock-closed" size={14} color={focused ? '#000' : '#EF4444'} />}
                <Text style={[styles.actionDemoButtonText, { color: focused ? '#000' : isAppLocked ? '#EF4444' : '#FFF' }]}>
                  {isAppLocked ? 'Trial Expired' : 'Demo'}
                </Text>
              </View>
            )}
          </TVFocusable>

          {/* 3. Store Button */}
          <TVFocusable
            onPress={() => setIsStoreOpen(true)}
            style={({ focused }: any) => [
              styles.actionSquareButton,
              focused && styles.actionButtonFocused,
            ]}
          >
            {({ focused }: any) => (
              <Ionicons name="cart" size={22} color={focused ? '#000' : '#FFF'} />
            )}
          </TVFocusable>
        </View>
      </View>
    </LinearGradient>
  );

  // Mobile layout
  if (isMobile) {
    return (
      <View style={{ flex: 1, backgroundColor: '#05070a' }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {renderLeftSection()}
          <View style={{ marginHorizontal: 16, marginTop: 10, borderRadius: 20, overflow: 'hidden' }}>
            {renderRightSection()}
          </View>
        </ScrollView>
        {renderStoreModal()}
      </View>
    );
  }

  // Desktop / TV full 50/50 split layout
  return (
    <View style={styles.screenContainer}>
      {/* Left 50%: Black side with Logo, App Info, Platforms & Thank you */}
      <View style={styles.leftHalfContainer}>
        {renderLeftSection()}
      </View>

      {/* Right 50%: Brushed Gold Metallic Panel with Steps & 3 Buttons */}
      <View style={styles.rightHalfContainer}>
        {renderRightSection()}
      </View>

      {renderStoreModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#05070a',
    width: '100%',
    height: '100%',
  },
  leftHalfContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingVertical: 20,
  },
  rightHalfContainer: {
    flex: 1,
    height: '100%',
  },
  leftContentWrapper: {
    width: '100%',
    maxWidth: 540,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftContentWrapperCompact: {
    paddingVertical: 10,
  },

  // Pure Text EN-TEC Logo Styles
  brandLettersWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  brandTitleText: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 3,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  brandSubtitleText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.65)',
    letterSpacing: 8,
    textTransform: 'uppercase',
    marginTop: 4,
    fontWeight: '700',
  },

  headlineText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 22,
    textAlign: 'center',
  },
  descriptionText: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.72)',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 10,
    maxWidth: 500,
  },
  availableOnTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 22,
    marginBottom: 12,
  },

  // Platforms Row
  platformsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },

  trialNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(244, 197, 66, 0.3)',
    backgroundColor: 'rgba(244, 197, 66, 0.08)',
  },
  trialNoticeText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
  },
  thankYouRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 6,
  },
  thankYouText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  // Right Calm Dark Luxury Panel Styles
  rightGoldPanel: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 24,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(244, 197, 66, 0.15)',
  },
  rightGoldPanelCompact: {
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  rightContentContainer: {
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldHeaderTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  goldSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
  },
  addingPlaylistTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F4C542',
    textAlign: 'center',
    marginVertical: 16,
  },
  stepsListContainer: {
    width: '100%',
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepDarkIconBox: {
    width: 32,
    height: 32,
    borderRadius: 7,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 17,
    fontWeight: '500',
  },
  stepLinkText: {
    color: '#F4C542',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  stepCredentialsLine: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
    lineHeight: 17,
  },
  credentialsHighlight: {
    color: '#F4C542',
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
  },
  stepMiniCopyBtn: {
    width: 30,
    height: 30,
    borderRadius: 7,
    backgroundColor: 'rgba(244, 197, 66, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244, 197, 66, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bottom 3 Action Buttons [ 🔄 ]  [ Demo ]  [ 🛒 ]
  bottomButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 22,
    width: '100%',
  },
  actionSquareButton: {
    width: 68,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(244, 197, 66, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDemoButton: {
    width: 120,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1.5,
    borderColor: 'rgba(244, 197, 66, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDemoButtonText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  actionButtonFocused: {
    backgroundColor: '#F4C542',
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.08 }],
    shadowColor: '#F4C542',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },

  // Store Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 780,
    backgroundColor: '#0c0f17',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  modalHeaderIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(212,168,67,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.25)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  modalSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.55)',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPlansContainer: {
    gap: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  planBox: {
    width: 220,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 18,
    position: 'relative',
  },
  planBoxPopular: {
    borderColor: '#F4C542',
    backgroundColor: 'rgba(212,168,67,0.06)',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 14,
    backgroundColor: '#F4C542',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  popularBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },
  planName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 6,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '900',
    color: '#F4C542',
  },
  planDuration: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 10,
  },
  planDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 10,
  },
  planFeatureText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  modalFooterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginTop: 20,
    gap: 12,
  },
  modalFooterText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  modalDismissBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  modalDismissBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});
