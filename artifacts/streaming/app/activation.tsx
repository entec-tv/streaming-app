import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/store/app-store';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TVFocusable } from '@/components/TVFocusable';
import { PlanCard } from '@/components/PlanCard';
import Constants from 'expo-constants';

let SERVER_URL = 'https://entecstreamingnestjs-production.up.railway.app/api';

if (__DEV__) {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    SERVER_URL = `http://${ip}:3000/api`;
  } else {
    SERVER_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://localhost:3000/api';
  }
}

export default function ActivationScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  
  const deviceId = useAppStore(s => s.deviceId);
  const deviceKey = useAppStore(s => s.deviceKey);
  const login = useAppStore(s => s.login);
  const subscriptionExpired = useAppStore(s => s.subscriptionExpired);

  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [appPlans, setAppPlans] = useState<any[]>([]);
  const [fetchingPlans, setFetchingPlans] = useState(true);
  
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkActivation = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      setLoadingMsg(t('checking_activation'));

      const response = await fetch(`${SERVER_URL}/client/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          macAddress: deviceId,
          deviceKey: deviceKey,
        }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        setLoadingMsg(t('activation_success'));
        login(data.token, data.customer);
        if (data.customer.subscriptions) {
          await useAppStore.getState().syncAdminSubscriptions(data.customer.subscriptions);
        }
        useAppStore.getState().setSubscriptionExpired(false);
        
        if (pollInterval.current) clearInterval(pollInterval.current);
        router.replace('/(tabs)');
      } else {
        setErrorMsg(data.message ? t(data.message) : t('device_not_registered'));
      }
    } catch (err) {
      console.warn('Activation check error:', err);
      setErrorMsg(t('connection_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Prevent infinite loop: if Xtream says expired, wait for manual user action
    if (!subscriptionExpired) {
      checkActivation();

      pollInterval.current = setInterval(() => {
        checkActivation();
      }, 10000);
    }

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [subscriptionExpired]);

  useEffect(() => {
    fetch(`${SERVER_URL}/plans`)
      .then(res => res.json())
      .then(data => {
        if (data && data.plans) {
          setAppPlans(data.plans);
        }
      })
      .catch(err => {
        console.warn('Failed to fetch app plans:', err);
      })
      .finally(() => {
        setFetchingPlans(false);
      });
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#05070a', overflow: 'hidden' }}>
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
        <LinearGradient
          colors={['rgba(212,168,67,0.15)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: -400, left: -400, width: 1000, height: 1000, borderRadius: 500 }}
        />
        <LinearGradient
          colors={['rgba(91,127,255,0.08)', 'transparent']}
          start={{ x: 1, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={{ position: 'absolute', bottom: -400, right: -400, width: 1000, height: 1000, borderRadius: 500 }}
        />
      </View>

      <View style={styles.twoColumnContainer}>
        <View style={styles.deviceColumn}>
          <ScrollView style={{ width: '100%' }} contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <View style={[styles.card, { backgroundColor: 'rgba(26,26,26,0.7)', borderColor: colors.border }]}>
              
              {subscriptionExpired && (
                <View style={styles.expiredBadge}>
                  <Ionicons name="alert-circle" size={24} color="#ff4444" />
                  <Text style={styles.expiredText}>{t('subscription_expired_badge')}</Text>
                </View>
              )}

              <View style={styles.cardHeader}>
                <Ionicons name="tv-outline" size={32} color={colors.gold} />
                <Text style={[styles.title, { color: colors.text }]}>{t('activate_device')}</Text>
              </View>
              
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {t('provide_details_to_activate')}
              </Text>

              <View style={styles.dataBox}>
                <Text style={[styles.dataLabel, { color: colors.mutedForeground }]}>{t('mac_address')}</Text>
                <Text style={[styles.dataValue, { color: colors.text }]} selectable>{deviceId || '...'}</Text>
              </View>

              <View style={[styles.dataBox, { borderColor: colors.gold }]}>
                <Text style={[styles.dataLabel, { color: colors.gold }]}>{t('device_key')}</Text>
                <Text style={[styles.dataValue, { color: colors.gold, fontSize: 32, fontWeight: '900', letterSpacing: 4 }]} selectable>
                  {deviceKey || '...'}
                </Text>
              </View>
              
              {errorMsg ? (
                <View style={styles.errorBox}>
                  <Ionicons name="warning" size={20} color="#ff4444" />
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              <View style={styles.loadingRow}>
                {loading ? <ActivityIndicator color={colors.gold} /> : <View style={{ width: 20 }} />}
                <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                  {loadingMsg || t('waiting_activation')}
                </Text>
              </View>

              <TVFocusable 
                onPress={checkActivation}
                style={({ focused }: any) => [
                  styles.button,
                  { backgroundColor: focused ? colors.gold : colors.surface2, borderColor: focused ? '#FFF' : colors.border }
                ]}
              >
                <Ionicons name="refresh" size={20} color={colors.text} />
                <Text style={[styles.buttonText, { color: colors.text }]}>{t('check_manually')}</Text>
              </TVFocusable>
            </View>
          </ScrollView>
        </View>

        <View style={styles.plansColumn}>
          <View style={styles.header}>
            <Text style={[styles.logoText, { color: colors.gold }]}>{t('en_tec')}</Text>
            <Text style={styles.logoSubtext}>{t('streaming')}</Text>
          </View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('choose_plan_title')}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
            {t('choose_plan_subtitle')}
          </Text>
          
          <ScrollView contentContainerStyle={styles.plansScroll} showsVerticalScrollIndicator={false}>
            {fetchingPlans ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1, padding: 40 }}>
                <ActivityIndicator color={colors.gold} size="large" />
                <Text style={{ color: colors.mutedForeground, marginTop: 16 }}>{t('loading_plans')}</Text>
              </View>
            ) : appPlans.length > 0 ? (
              appPlans.map((plan: any) => (
                <PlanCard
                  key={plan._id}
                  title={plan.name}
                  price={plan.price}
                  duration={plan.duration}
                  features={plan.features || []}
                  isPopular={plan.isPopular}
                  onPress={() => console.log('Selected Plan:', plan.name)}
                />
              ))
            ) : (
              <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1, padding: 40 }}>
                <Ionicons name="information-circle-outline" size={48} color={colors.border} />
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: 24,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  logoText: {
    fontSize: 40,
    fontWeight: '900',
  },
  logoSubtext: {
    color: '#FFF',
    fontSize: 14,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  twoColumnContainer: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 40,
    paddingBottom: 20,
    gap: 40,
  },
  plansColumn: {
    flex: 1.2,
    justifyContent: 'flex-start',
  },
  deviceColumn: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'left',
  },
  sectionSubtitle: {
    fontSize: 18,
    marginBottom: 32,
    textAlign: 'left',
  },
  plansScroll: {
    paddingBottom: 24,
    paddingRight: 10,
  },
  card: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 32,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  expiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    marginBottom: 24,
    gap: 8,
  },
  expiredText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  dataBox: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dataLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dataValue: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 24,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '500',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    width: '100%',
    marginTop: 4,
  },
  infoBoxWrapper: {
    width: '100%',
    marginBottom: 16,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
    textAlign: 'left',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  }
});
