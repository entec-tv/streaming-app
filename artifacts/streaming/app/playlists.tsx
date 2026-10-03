import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lineicons } from '@lineiconshq/react-native-lineicons';
import { ArrowLeftBulk, PlusBulk, CheckCircle1Bulk, RefreshCircle1ClockwiseBulk, Trash3Bulk, XmarkBulk, Shield2Bulk, Tickets3Bulk, User4Bulk, Locked1Bulk, Folder1Bulk, Link2AngularRightBulk, MonitorBulk } from '@lineiconshq/free-icons';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { TVFocusable } from '@/components/TVFocusable';
import { useAppStore } from '@/store/app-store';
import { GoldButton } from '@/components/GoldButton';
import { LinearGradient } from 'expo-linear-gradient';
import { base64Encode } from '@/lib/base64';
import { StartupPreloader } from '@/components/StartupPreloader';

type AddTab = 'm3u' | 'xtream';

export default function PlaylistsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { playlists, activePlaylistId, setActivePlaylist, deletePlaylist, addPlaylist, loadPlaylistFromUrl, refreshPlaylist, deviceId, deviceKey } =
    useAppStore();

  const [showAdd, setShowAdd] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState<{ id: string; name: string } | null>(null);
  const [addTab, setAddTab] = useState<AddTab>('m3u');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [preloadStatus, setPreloadStatus] = useState('');
  const [preloadPlaylistName, setPreloadPlaylistName] = useState('');

  const [m3uUrl, setM3uUrl] = useState('');
  const [m3uName, setM3uName] = useState('');
  const [xtreamHost, setXtreamHost] = useState('');
  const [xtreamUser, setXtreamUser] = useState('');
  const [xtreamPass, setXtreamPass] = useState('');
  const [xtreamName, setXtreamName] = useState('');

  const resetForm = () => {
    setM3uUrl('');
    setM3uName('');
    setXtreamHost('');
    setXtreamUser('');
    setXtreamPass('');
    setXtreamName('');
    setLoadingMsg('');
  };

  const handleAddM3U = async () => {
    const url = m3uUrl.trim();
    if (!url) {
      Alert.alert('Error', 'Please enter a valid M3U URL');
      return;
    }
    const name = m3uName.trim() || 'My Playlist';
    const id = `pl_${Date.now()}`;

    setLoading(true);
    try {
      const { channels } = await loadPlaylistFromUrl(id, url, setLoadingMsg);
      await addPlaylist(
        {
          id,
          name,
          url,
          channels,
          updated: 'Just now',
          lastUpdatedTimestamp: Date.now(),
          isDemo: false,
        }
      );
      setShowAdd(false);
      resetForm();
      setIsPreloading(true);
      setPreloadPlaylistName(name);
      await useAppStore.getState().preloadFullPlaylistContent(id, (pct, msg) => {
        setPreloadProgress(pct);
        setPreloadStatus(msg);
      });
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Failed to load playlist', err.message ?? 'Unknown error');
    } finally {
      setIsPreloading(false);
      setLoading(false);
    }
  };

  const handleAddXtream = async () => {
    const host = xtreamHost.trim().replace(/\/$/, '');
    const user = xtreamUser.trim();
    const pass = xtreamPass.trim();
    const name = xtreamName.trim() || 'Xtream Playlist';

    if (!host || !user || !pass) {
      Alert.alert('Error', 'Please fill in Host, Username, and Password');
      return;
    }

    const m3uUrl = `${host}/get.php?username=${user}&password=${pass}&type=m3u_plus&output=ts`;
    const id = `xt_${Date.now()}`;
    const encodedCreds = base64Encode(JSON.stringify({ host, username: user, password: pass }));
    const storedUrl = `xtream://${encodedCreds}`;

    setLoading(true);
    try {
      const { channels, expireText } = await loadPlaylistFromUrl(id, m3uUrl, setLoadingMsg);
      await addPlaylist({
        id,
        name,
        url: storedUrl,
        channels,
        updated: expireText || 'Active',
        lastUpdatedTimestamp: Date.now(),
        isDemo: false,
      });
      setShowAdd(false);
      resetForm();
      setIsPreloading(true);
      setPreloadPlaylistName(name);
      await useAppStore.getState().preloadFullPlaylistContent(id, (pct, msg) => {
        setPreloadProgress(pct);
        setPreloadStatus(msg);
      });
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Failed to connect', err.message ?? 'Check your Xtream credentials');
    } finally {
      setIsPreloading(false);
      setLoading(false);
    }
  };

  const handleRefresh = async (id: string) => {
    setRefreshingId(id);
    try {
      await refreshPlaylist(id);
    } catch (err: any) {
      Alert.alert('Refresh failed', err.message ?? 'Could not refresh playlist');
    } finally {
      setRefreshingId(null);
    }
  };

  const handleDelete = (id: string, name: string) => {
    setPlaylistToDelete({ id, name });
  };

  if (isPreloading) {
    return (
      <StartupPreloader
        progress={preloadProgress}
        statusMessage={preloadStatus}
        playlistName={preloadPlaylistName}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: 'transparent', paddingTop: insets.top }]}>
      <View style={styles.header}>
        {playlists.length > 0 ? (
          <TVFocusable onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/(tabs)'); } }} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.foreground} />
          </TVFocusable>
        ) : (
          <View style={{ width: 8 }} />
        )}
        <Text style={[styles.title, { color: colors.text, flex: 1, marginLeft: 12 }]}>{t('playlists')}</Text>
        
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <TVFocusable
            style={[styles.addBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.gold }]}
            onPress={() => {
              useAppStore.getState().setGlobalShowTour(true);
              router.replace('/(tabs)');
            }}
          >
            <Ionicons name="help-circle-outline" size={20} color={colors.gold} />
          </TVFocusable>
        </View>
      </View>

      <FlatList
        data={playlists}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
        ListHeaderComponent={() => (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20, marginBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
            <View>
              <Text style={{ color: colors.mutedForeground, fontSize: 13, marginBottom: 6, fontWeight: '600' }}>{t('mac_address')}</Text>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', letterSpacing: 1 }} selectable>{deviceId}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: colors.gold, fontSize: 13, marginBottom: 6, fontWeight: '600' }}>{t('device_key')}</Text>
              <Text style={{ color: colors.gold, fontSize: 18, fontWeight: '900', letterSpacing: 1 }} selectable>{deviceKey}</Text>
            </View>
          </View>
        )}
        renderItem={({ item }) => {
          const isActive = item.id === activePlaylistId;
          const isRefreshing = refreshingId === item.id;
          return (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isActive ? 'rgba(212,168,67,0.08)' : colors.surface,
                  borderColor: isActive ? colors.gold : colors.border,
                  padding: 0,
                  overflow: 'hidden',
                },
              ]}
            >
              <TVFocusable
                style={{ padding: 24 }}
                onPress={async () => {
                  await setActivePlaylist(item.id);
                  router.replace('/(tabs)');
                }}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    {isActive && (
                      <View style={[styles.activeDot, { backgroundColor: colors.gold }]} />
                    )}
                    <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                      {item.id.startsWith('admin_sub_') || item.name === 'admin_subscription' ? (t('admin_subscription') || 'الاشتراك الرئيسي') : item.name}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {isActive && (
                      <Lineicons icon={CheckCircle1Bulk} size={18} color={colors.gold} />
                    )}
                  </View>
                </View>

                <Text
                  style={[styles.url, { color: colors.mutedForeground, marginTop: 12 }]}
                  numberOfLines={1}
                >
                  {item.id.startsWith('admin_sub_') || item.name === 'admin_subscription'
                    ? (t('admin_subscription') || 'الاشتراك الرئيسي')
                    : item.url.startsWith('xtream://')
                    ? 'Xtream Codes'
                    : item.url.startsWith('demo://')
                    ? 'Demo playlist'
                    : item.url}
                </Text>

                <View style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[styles.meta, { color: colors.mutedForeground, marginBottom: 0 }]}>
                    {item.updated}
                  </Text>
                </View>
              </TVFocusable>

              {!item.isDemo && (
                <View style={[styles.actions, { position: 'absolute', bottom: 24, right: 24 }]}>
                  <TVFocusable
                    style={styles.actionBtn}
                    onPress={() => handleRefresh(item.id)}
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? (
                      <ActivityIndicator size="small" color={colors.mutedForeground} />
                    ) : (
                      <Lineicons icon={RefreshCircle1ClockwiseBulk} size={16} color={colors.mutedForeground} />
                    )}
                  </TVFocusable>
                  <TVFocusable
                    style={styles.actionBtn}
                    onPress={() => handleDelete(item.id, item.name)}
                  >
                    <Lineicons icon={Trash3Bulk} size={16} color={colors.destructive} />
                  </TVFocusable>
                </View>
              )}
            </View>
          );
        }}
      />

      {showAdd && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[StyleSheet.absoluteFill, styles.modalOverlay]}
        >
          <TVFocusable focusable={false} disableBorder style={StyleSheet.absoluteFill} onPress={() => !loading && setShowAdd(false)} />
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.surface, paddingBottom: insets.bottom + 24 },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('add_playlist')}</Text>
              <TVFocusable onPress={() => !loading && setShowAdd(false)}>
                <Lineicons icon={XmarkBulk} size={24} color={colors.foreground} />
              </TVFocusable>
            </View>

            <View style={[styles.tabRow, { backgroundColor: colors.surface2 }]}>
              {(['m3u', 'xtream'] as AddTab[]).map((t) => (
                <TVFocusable
                  key={t}
                  style={[styles.tabBtn, addTab === t && { backgroundColor: colors.gold }]}
                  onPress={() => setAddTab(t)}
                >
                  <Text
                    style={[
                      styles.tabBtnText,
                      { color: addTab === t ? '#1A1A1A' : colors.mutedForeground },
                    ]}
                  >
                    {t === 'm3u' ? 'M3U URL' : 'Xtream Codes'}
                  </Text>
                </TVFocusable>
              ))}
            </View>

            {addTab === 'm3u' ? (
              <View style={styles.form}>
                <StyledInput
                  placeholder="Playlist Name (optional)"
                  value={m3uName}
                  onChangeText={setM3uName}
                  icon={Tickets3Bulk}
                  colors={colors}
                />
                <StyledInput
                  placeholder="M3U URL  e.g. http://..."
                  value={m3uUrl}
                  onChangeText={setM3uUrl}
                  icon={Link2AngularRightBulk}
                  colors={colors}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
            ) : (
              <View style={styles.form}>
                <View
                  style={[
                    styles.xtreamWarning,
                    { backgroundColor: 'rgba(212,168,67,0.08)', borderColor: colors.gold },
                  ]}
                >
                  <Lineicons icon={Shield2Bulk} size={14} color={colors.gold} />
                  <Text style={[styles.xtreamWarningText, { color: colors.gold }]}>
                    Frequent queries may flag your account. Data is cached for 12h.
                  </Text>
                </View>
                <StyledInput
                  placeholder="Playlist Name"
                  value={xtreamName}
                  onChangeText={setXtreamName}
                  icon={Tickets3Bulk}
                  colors={colors}
                />
                <StyledInput
                  placeholder="Server URL  e.g. http://server.com:8080"
                  value={xtreamHost}
                  onChangeText={setXtreamHost}
                  icon={Link2AngularRightBulk}
                  colors={colors}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <StyledInput
                  placeholder="Username"
                  value={xtreamUser}
                  onChangeText={setXtreamUser}
                  icon={User4Bulk}
                  colors={colors}
                  autoCapitalize="none"
                />
                <StyledInput
                  placeholder="Password"
                  value={xtreamPass}
                  onChangeText={setXtreamPass}
                  icon={Locked1Bulk}
                  colors={colors}
                  secureTextEntry
                />
              </View>
            )}

            {loading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.gold} />
                <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                  {loadingMsg || 'Loading...'}
                </Text>
              </View>
            )}

            <View
              style={[
                styles.submitBtn,
                { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.gold },
                loading && { opacity: 0.6 }
              ]}
            >
              <TVFocusable
                style={styles.submitBtnInner}
                onPress={addTab === 'm3u' ? handleAddM3U : handleAddXtream}
                disabled={loading}
              >
                <Text style={[styles.submitBtnText, { color: colors.gold }]}>
                  {loading ? 'Loading...' : addTab === 'm3u' ? 'Load Playlist' : 'Connect'}
                </Text>
              </TVFocusable>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
      {playlistToDelete && (
        <View style={[StyleSheet.absoluteFill, styles.modalOverlay, { justifyContent: 'center', alignItems: 'center', zIndex: 9999 }]}>
          <TVFocusable focusable={false} disableBorder style={StyleSheet.absoluteFill} onPress={() => setPlaylistToDelete(null)} />
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 24,
              width: '90%',
              maxWidth: 420,
              borderWidth: 1,
              borderColor: colors.border,
              zIndex: 10000,
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(239,68,68,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                <Lineicons icon={Trash3Bulk} size={28} color="#EF4444" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, textAlign: 'center' }}>
                {t('delete_playlist') || 'حذف قائمة التشغيل'}
              </Text>
              <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
                {`هل أنت متأكد من حذف قائمة "${playlistToDelete.name}"؟`}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TVFocusable
                style={({ focused }: any) => [
                  {
                    flex: 1,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: colors.surface2,
                    justifyContent: 'center',
                    alignItems: 'center',
                  },
                  focused && { borderColor: colors.gold, borderWidth: 1 }
                ]}
                onPress={() => setPlaylistToDelete(null)}
              >
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>
                  {t('cancel') || 'إلغاء'}
                </Text>
              </TVFocusable>

              <TVFocusable
                hasTVPreferredFocus={true}
                style={({ focused }: any) => [
                  {
                    flex: 1,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: '#EF4444',
                    justifyContent: 'center',
                    alignItems: 'center',
                  },
                  focused && { transform: [{ scale: 1.05 }], backgroundColor: '#DC2626' }
                ]}
                onPress={async () => {
                  const targetId = playlistToDelete.id;
                  setPlaylistToDelete(null);
                  await deletePlaylist(targetId);
                }}
              >
                <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 14 }}>
                  {t('delete') || 'حذف'}
                </Text>
              </TVFocusable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function StyledInput({
  placeholder,
  value,
  onChangeText,
  icon,
  colors,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
}: any) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = React.useRef<TextInput>(null);

  return (
    <TVFocusable
      onPress={() => inputRef.current?.focus()}
      style={({ focused }: any) => [
        styledInputStyles.container,
        { backgroundColor: 'transparent', borderColor: focused || isFocused ? colors.gold : colors.border },
      ]}
    >
      <Lineicons icon={icon} size={20} color={isFocused ? colors.gold : colors.mutedForeground} style={styledInputStyles.icon} />
      <TextInput
        ref={inputRef}
        style={[styledInputStyles.input, { color: colors.text, outlineStyle: 'none' } as any]}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        keyboardType={keyboardType ?? 'default'}
        autoCorrect={false}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        focusable={false}
      />
    </TVFocusable>
  );
}

const styledInputStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 24, fontWeight: 'bold' },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { padding: 20, gap: 14 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', flex: 1 },
  url: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: { fontSize: 12 },
  actions: { flexDirection: 'row', gap: 16 },
  actionBtn: { padding: 4 },
  modalOverlay: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  tabRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabBtnText: { fontSize: 14, fontWeight: '600' },
  form: { gap: 12 },
  xtreamWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  xtreamWarningText: { flex: 1, fontSize: 12, lineHeight: 18 },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  loadingText: { fontSize: 13 },
  submitBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },
  submitBtnInner: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
