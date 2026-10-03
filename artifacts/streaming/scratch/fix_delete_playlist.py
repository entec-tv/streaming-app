import re

def update_app_store():
    path = r"c:\streaming\artifacts\streaming\store\app-store.ts"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update deletePlaylist
    old_delete = """  deletePlaylist: async (id) => {
    const newPlaylists = get().playlists.filter((p) => p.id !== id);
    const newChannels = { ...get().playlistChannels };
    delete newChannels[id];
    set({ playlists: newPlaylists, playlistChannels: newChannels, activeCategories: null, channels: [] });
    if (get().activePlaylistId === id) {
      set({ activePlaylistId: newPlaylists[0]?.id ?? '' });
    }
    await AsyncStorage.setItem('playlists', JSON.stringify(newPlaylists));
    await AsyncStorage.removeItem(`channels_${id}`);
    await AsyncStorage.removeItem(`categories_${id}`);
  },"""

    new_delete = """  deletePlaylist: async (id) => {
    const newPlaylists = get().playlists.filter((p) => p.id !== id);
    const newChannels = { ...get().playlistChannels };
    delete newChannels[id];
    
    const wasActive = get().activePlaylistId === id;
    const nextActiveId = newPlaylists[0]?.id ?? '';
    
    set({
      playlists: newPlaylists,
      playlistChannels: newChannels,
      ...(wasActive ? { activePlaylistId: nextActiveId, activeCategories: null, channels: [] } : {})
    });
    
    await AsyncStorage.setItem('playlists', JSON.stringify(newPlaylists));
    if (wasActive) {
      await AsyncStorage.setItem('activePlaylistId', nextActiveId);
    }
    
    await AsyncStorage.removeItem(`channels_${id}`);
    await AsyncStorage.removeItem(`categories_${id}`);
    await AsyncStorage.removeItem(`search_index_${id}`);
    
    if (id.startsWith('admin_sub_')) {
      try {
        const storedDeleted = await AsyncStorage.getItem('deleted_admin_subs');
        const list = storedDeleted ? JSON.parse(storedDeleted) : [];
        if (!list.includes(id)) {
          list.push(id);
          await AsyncStorage.setItem('deleted_admin_subs', JSON.stringify(list));
        }
      } catch (e) {}
    }
  },"""

    if old_delete in content:
        content = content.replace(old_delete, new_delete)

    # 2. Update syncAdminSubscriptions to respect deleted_admin_subs
    old_sync_start = """  syncAdminSubscriptions: async (subscriptions, options) => {
    const adminIds = subscriptions.map(s => `admin_sub_${s.id}`);
    
    // Remove old admin subscriptions that are no longer in the list
    let currentPlaylists = [...get().playlists];"""

    new_sync_start = """  syncAdminSubscriptions: async (subscriptions, options) => {
    const adminIds = subscriptions.map(s => `admin_sub_${s.id}`);
    
    let deletedAdminSubs: string[] = [];
    try {
      const stored = await AsyncStorage.getItem('deleted_admin_subs');
      if (stored) deletedAdminSubs = JSON.parse(stored);
    } catch (e) {}

    // Remove old admin subscriptions that are no longer in the list
    let currentPlaylists = [...get().playlists];"""

    if old_sync_start in content:
        content = content.replace(old_sync_start, new_sync_start)

    old_sub_loop = """    // Process new/updated subscriptions
    for (const sub of subscriptions) {
      const playlistId = `admin_sub_${sub.id}`;
      const hostClean = (sub.host || '').endsWith('/') ? sub.host.slice(0, -1) : (sub.host || '');"""

    new_sub_loop = """    // Process new/updated subscriptions
    for (const sub of subscriptions) {
      const playlistId = `admin_sub_${sub.id}`;
      if (deletedAdminSubs.includes(playlistId) && !options?.forceReload) {
        continue;
      }
      const hostClean = (sub.host || '').endsWith('/') ? sub.host.slice(0, -1) : (sub.host || '');"""

    if old_sub_loop in content:
        content = content.replace(old_sub_loop, new_sub_loop)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated app-store.ts successfully!")

def update_playlists():
    path = r"c:\streaming\artifacts\streaming\app\playlists.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Add state playlistToDelete
    if "const [playlistToDelete, setPlaylistToDelete]" not in content:
        content = content.replace(
            "  const [showAdd, setShowAdd] = useState(false);",
            "  const [showAdd, setShowAdd] = useState(false);\n  const [playlistToDelete, setPlaylistToDelete] = useState<{ id: string; name: string } | null>(null);"
        )

    # 2. Replace handleDelete
    old_handle_delete = """  const handleDelete = (id: string, name: string) => {
    if (id.startsWith('admin_sub_')) {
      Alert.alert(t('not_allowed'), t('cannot_delete_admin_subscription'));
      return;
    }
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove "${name}"?`)) {
        deletePlaylist(id);
      }
    } else {
      Alert.alert('Delete Playlist', `Remove "${name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deletePlaylist(id),
        },
      ]);
    }
  };"""

    new_handle_delete = """  const handleDelete = (id: string, name: string) => {
    setPlaylistToDelete({ id, name });
  };"""

    if old_handle_delete in content:
        content = content.replace(old_handle_delete, new_handle_delete)

    # 3. Add modal before the last closing </View> of PlaylistsScreen
    modal_code = """      {playlistToDelete && (
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
      )}"""

    old_modal_placement = """        </KeyboardAvoidingView>
      )}
    </View>
  );
}"""

    new_modal_placement = f"""        </KeyboardAvoidingView>
      )}}
{modal_code}
    </View>
  );
}}"""

    if old_modal_placement in content and "playlistToDelete &&" not in content:
        content = content.replace(old_modal_placement, new_modal_placement)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated playlists.tsx successfully!")

update_app_store()
update_playlists()
