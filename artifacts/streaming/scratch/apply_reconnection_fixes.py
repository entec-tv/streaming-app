import re

def update_movies():
    path = r"c:\streaming\artifacts\streaming\app\(tabs)\movies.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. State
    if "isNetworkOnline" not in content:
        content = content.replace(
            "  const refreshCounter = useAppStore((s) => s.refreshCounter);",
            "  const refreshCounter = useAppStore((s) => s.refreshCounter);\n  const isNetworkOnline = useAppStore((s) => s.isNetworkOnline);"
        )

    # 2. activeRequestId ref
    if "activeRequestId = useRef(0);" not in content:
        content = content.replace(
            "  const [loading, setLoading] = useState(false);",
            "  const [loading, setLoading] = useState(false);\n  const activeRequestId = useRef(0);"
        )

    # 3. loadCategory race protection
    old_load = """  const loadCategory = useCallback(async (cat: { id: string; name: string }) => {
    if (!activePlaylistId) return;
    setDisplayCount(20);
    setLoading(true);

    try {
      let result: Channel[] = [];
      const store = useAppStore.getState();

      if (cat.id === '__all__') {
        const vodCats = store.activeCategories?.vod || [];
        if (vodCats.length > 0) {
          const randomCats = [...vodCats].sort(() => 0.5 - Math.random()).slice(0, 5);
          const chunks = await Promise.all(
            randomCats.map(c => getChannelsForCategory(activePlaylistId, 'vod', c.id, c.name).catch(() => []))
          );
          result = chunks.flat().sort(() => 0.5 - Math.random());
        }
      } else if (cat.id === '__recent__') {
        result = store.continueWatching
          .filter((i) => i.type === 'vod' && i.progress > 0)
          .map((i) => ({ ...i, category: i.category || 'VOD' } as unknown as Channel));
      } else if (cat.id === '__favorites__') {
        result = store.favoriteItems
          .filter((i) => i.type === 'vod')
          .map((i) => ({ ...i, category: i.category || 'VOD' } as unknown as Channel));
      } else {
        result = await getChannelsForCategory(activePlaylistId, 'vod', cat.id, cat.name);
      }

      const mapped = result.map((c: Channel) => ({
        id: c.id,
        title: c.name,
        poster: c.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=1A1A1A&color=D4A843&bold=true&size=300&format=svg`,
        backdrop: c.logo,
        rating: 0,
        year: 0,
        duration: '',
        quality: c.quality,
        genres: [c.category],
        description: '',
        streamUrl: c.streamUrl,
      }));
      setLocalMovies(mapped);
    } catch (e) {
      setLocalMovies([]);
    } finally {
      setLoading(false);
    }
  }, [activePlaylistId, getChannelsForCategory]);"""

    new_load = """  const loadCategory = useCallback(async (cat: { id: string; name: string }) => {
    if (!activePlaylistId) return;
    const reqId = ++activeRequestId.current;
    setDisplayCount(20);
    setLoading(true);

    try {
      let result: Channel[] = [];
      const store = useAppStore.getState();

      if (cat.id === '__all__') {
        const vodCats = store.activeCategories?.vod || [];
        if (vodCats.length > 0) {
          const randomCats = [...vodCats].sort(() => 0.5 - Math.random()).slice(0, 5);
          const chunks = await Promise.all(
            randomCats.map(c => getChannelsForCategory(activePlaylistId, 'vod', c.id, c.name).catch(() => []))
          );
          result = chunks.flat().sort(() => 0.5 - Math.random());
        }
      } else if (cat.id === '__recent__') {
        result = store.continueWatching
          .filter((i) => i.type === 'vod' && i.progress > 0)
          .map((i) => ({ ...i, category: i.category || 'VOD' } as unknown as Channel));
      } else if (cat.id === '__favorites__') {
        result = store.favoriteItems
          .filter((i) => i.type === 'vod')
          .map((i) => ({ ...i, category: i.category || 'VOD' } as unknown as Channel));
      } else {
        result = await getChannelsForCategory(activePlaylistId, 'vod', cat.id, cat.name);
      }

      if (activeRequestId.current !== reqId) return;

      const mapped = result.map((c: Channel) => ({
        id: c.id,
        title: c.name,
        poster: c.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=1A1A1A&color=D4A843&bold=true&size=300&format=svg`,
        backdrop: c.logo,
        rating: 0,
        year: 0,
        duration: '',
        quality: c.quality,
        genres: [c.category],
        description: '',
        streamUrl: c.streamUrl,
      }));
      setLocalMovies(mapped);
    } catch (e) {
      if (activeRequestId.current !== reqId) return;
      setLocalMovies([]);
    } finally {
      if (activeRequestId.current === reqId) {
        setLoading(false);
      }
    }
  }, [activePlaylistId, getChannelsForCategory]);

  const handleCategoryPress = useCallback((cat: { id: string; name: string }) => {
    if (isParentalLocked(cat.id)) {
      setPendingCategory(cat);
      setPinModalVisible(true);
    } else {
      if (selectedCategory && String(selectedCategory.id) === String(cat.id)) {
        loadCategory(cat);
      } else {
        setSelectedCategory(cat);
      }
    }
  }, [isParentalLocked, selectedCategory, loadCategory]);"""

    if old_load in content:
        content = content.replace(old_load, new_load)

    # 4. Use handleCategoryPress in desktop category item
    old_desktop_press = """                      onPress={() => {
                        if (isParentalLocked(item.id)) {
                          setPendingCategory(item);
                          setPinModalVisible(true);
                        } else {
                          setSelectedCategory(item);
                        }
                      }}"""

    new_desktop_press = """                      onPress={() => {
                        handleCategoryPress(item);
                      }}"""

    if old_desktop_press in content:
        content = content.replace(old_desktop_press, new_desktop_press)

    # 5. Use handleCategoryPress in mobile category item
    content = content.replace(
        "onPress={() => setSelectedCategory(item)}",
        "onPress={() => handleCategoryPress(item)}"
    )

    # 6. Desktop empty state with Retry button
    old_desktop_empty = """            ) : filteredMovies.length === 0 ? (
              <View style={styles.centerAll}>
                <Lineicons icon={Search1Bulk} size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12 }]}>{t('no_movies')}</Text>
              </View>
            ) : ("""

    new_desktop_empty = """            ) : filteredMovies.length === 0 ? (
              <View style={styles.centerAll}>
                <Lineicons icon={Search1Bulk} size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12, marginBottom: 16 }]}>
                  {searchQuery ? t('no_movies') : (isNetworkOnline === false ? 'لا يوجد اتصال بالإنترنت' : t('no_movies'))}
                </Text>
                {selectedCategory && (
                  <TVFocusable
                    onPress={() => loadCategory(selectedCategory)}
                    style={({ focused }: any) => [
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.gold,
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        borderRadius: 8,
                        gap: 8,
                      },
                      focused && { transform: [{ scale: 1.05 }], backgroundColor: '#f0c767' }
                    ]}
                  >
                    <Ionicons name="refresh" size={18} color="#000" />
                    <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 14 }}>
                      إعادة المحاولة
                    </Text>
                  </TVFocusable>
                )}
              </View>
            ) : ("""

    if old_desktop_empty in content:
        content = content.replace(old_desktop_empty, new_desktop_empty)

    # 7. Mobile empty state with Retry button
    old_mobile_empty = """        ) : localMovies.length === 0 ? (
          <View style={styles.centerAll}>
            <Lineicons icon={MonitorBulk} size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12 }]}>{t('no_movies')}</Text>
          </View>
        ) : ("""

    new_mobile_empty = """        ) : localMovies.length === 0 ? (
          <View style={styles.centerAll}>
            <Lineicons icon={MonitorBulk} size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12, marginBottom: 16 }]}>
              {isNetworkOnline === false ? 'لا يوجد اتصال بالإنترنت' : t('no_movies')}
            </Text>
            {selectedCategory && (
              <TVFocusable
                onPress={() => loadCategory(selectedCategory)}
                style={({ focused }: any) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.gold,
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 8,
                    gap: 8,
                  },
                  focused && { transform: [{ scale: 1.05 }], backgroundColor: '#f0c767' }
                ]}
              >
                <Ionicons name="refresh" size={18} color="#000" />
                <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 14 }}>
                  إعادة المحاولة
                </Text>
              </TVFocusable>
            )}
          </View>
        ) : ("""

    if old_mobile_empty in content:
        content = content.replace(old_mobile_empty, new_mobile_empty)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated movies.tsx successfully!")

def update_series():
    path = r"c:\streaming\artifacts\streaming\app\(tabs)\series.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. State
    if "isNetworkOnline" not in content:
        content = content.replace(
            "  const refreshCounter = useAppStore((s) => s.refreshCounter);",
            "  const refreshCounter = useAppStore((s) => s.refreshCounter);\n  const isNetworkOnline = useAppStore((s) => s.isNetworkOnline);"
        )

    # 2. activeRequestId ref
    if "activeRequestId = useRef(0);" not in content:
        content = content.replace(
            "  const [loading, setLoading] = useState(false);",
            "  const [loading, setLoading] = useState(false);\n  const activeRequestId = useRef(0);"
        )

    # 3. loadCategory race protection
    old_load = """  const loadCategory = useCallback(async (cat: { id: string; name: string }) => {
    if (!activePlaylistId) return;
    setDisplayCount(20);
    setLoading(true);
    try {
      let result: Channel[] = [];
      const store = useAppStore.getState();

      if (cat.id === '__all__') {
        const seriesCats = store.activeCategories?.series || [];
        if (seriesCats.length > 0) {
          const randomCats = [...seriesCats].sort(() => 0.5 - Math.random()).slice(0, 5);
          const chunks = await Promise.all(
            randomCats.map(c => getChannelsForCategory(activePlaylistId, 'series', c.id, c.name).catch(() => []))
          );
          result = chunks.flat().sort(() => 0.5 - Math.random());
        }
      } else if (cat.id === '__recent__') {
        result = store.continueWatching
          .filter((i) => i.type === 'series' && i.progress > 0)
          .map((i) => ({ ...i, category: i.category || 'Series' } as unknown as Channel));
      } else if (cat.id === '__favorites__') {
        result = store.favoriteItems
          .filter((i) => i.type === 'series')
          .map((i) => ({ ...i, category: i.category || 'Series' } as unknown as Channel));
      } else {
        result = await getChannelsForCategory(activePlaylistId, 'series', cat.id, cat.name);
      }

      const mapped = result.map((c: Channel) => ({
        id: c.id,
        title: c.name,
        poster: c.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=1A1A1A&color=D4A843&bold=true&size=300&format=svg`,
        backdrop: c.logo,
        rating: 0,
        year: 0,
        seasons: 1,
        genres: [c.category],
        description: '',
        streamUrl: c.streamUrl,
        episodes: [],
      }));
      setLocalSeries(mapped);
    } catch (e) {
      setLocalSeries([]);
    } finally {
      setLoading(false);
    }
  }, [activePlaylistId, getChannelsForCategory]);"""

    new_load = """  const loadCategory = useCallback(async (cat: { id: string; name: string }) => {
    if (!activePlaylistId) return;
    const reqId = ++activeRequestId.current;
    setDisplayCount(20);
    setLoading(true);
    try {
      let result: Channel[] = [];
      const store = useAppStore.getState();

      if (cat.id === '__all__') {
        const seriesCats = store.activeCategories?.series || [];
        if (seriesCats.length > 0) {
          const randomCats = [...seriesCats].sort(() => 0.5 - Math.random()).slice(0, 5);
          const chunks = await Promise.all(
            randomCats.map(c => getChannelsForCategory(activePlaylistId, 'series', c.id, c.name).catch(() => []))
          );
          result = chunks.flat().sort(() => 0.5 - Math.random());
        }
      } else if (cat.id === '__recent__') {
        result = store.continueWatching
          .filter((i) => i.type === 'series' && i.progress > 0)
          .map((i) => ({ ...i, category: i.category || 'Series' } as unknown as Channel));
      } else if (cat.id === '__favorites__') {
        result = store.favoriteItems
          .filter((i) => i.type === 'series')
          .map((i) => ({ ...i, category: i.category || 'Series' } as unknown as Channel));
      } else {
        result = await getChannelsForCategory(activePlaylistId, 'series', cat.id, cat.name);
      }

      if (activeRequestId.current !== reqId) return;

      const mapped = result.map((c: Channel) => ({
        id: c.id,
        title: c.name,
        poster: c.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=1A1A1A&color=D4A843&bold=true&size=300&format=svg`,
        backdrop: c.logo,
        rating: 0,
        year: 0,
        seasons: 1,
        genres: [c.category],
        description: '',
        streamUrl: c.streamUrl,
        episodes: [],
      }));
      setLocalSeries(mapped);
    } catch (e) {
      if (activeRequestId.current !== reqId) return;
      setLocalSeries([]);
    } finally {
      if (activeRequestId.current === reqId) {
        setLoading(false);
      }
    }
  }, [activePlaylistId, getChannelsForCategory]);

  const handleCategoryPress = useCallback((cat: { id: string; name: string }) => {
    if (isParentalLocked(cat.id)) {
      setPendingCategory(cat);
      setPinModalVisible(true);
    } else {
      if (selectedCategory && String(selectedCategory.id) === String(cat.id)) {
        loadCategory(cat);
      } else {
        setSelectedCategory(cat);
      }
    }
  }, [isParentalLocked, selectedCategory, loadCategory]);"""

    if old_load in content:
        content = content.replace(old_load, new_load)

    # 4. Use handleCategoryPress in desktop
    old_desktop_press = """                      onPress={() => {
                        if (isParentalLocked(item.id)) {
                          setPendingCategory(item);
                          setPinModalVisible(true);
                        } else {
                          setSelectedCategory(item);
                        }
                      }}"""

    new_desktop_press = """                      onPress={() => {
                        handleCategoryPress(item);
                      }}"""

    if old_desktop_press in content:
        content = content.replace(old_desktop_press, new_desktop_press)

    # 5. Use handleCategoryPress in mobile
    content = content.replace(
        "onPress={() => setSelectedCategory(item)}",
        "onPress={() => handleCategoryPress(item)}"
    )

    # 6. Desktop empty state
    old_desktop_empty = """            ) : filteredSeries.length === 0 ? (
              <View style={styles.centerAll}>
                <Lineicons icon={Search1Bulk} size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12 }]}>{t('no_series')}</Text>
              </View>
            ) : ("""

    new_desktop_empty = """            ) : filteredSeries.length === 0 ? (
              <View style={styles.centerAll}>
                <Lineicons icon={Search1Bulk} size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12, marginBottom: 16 }]}>
                  {searchQuery ? t('no_series') : (isNetworkOnline === false ? 'لا يوجد اتصال بالإنترنت' : t('no_series'))}
                </Text>
                {selectedCategory && (
                  <TVFocusable
                    onPress={() => loadCategory(selectedCategory)}
                    style={({ focused }: any) => [
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.gold,
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        borderRadius: 8,
                        gap: 8,
                      },
                      focused && { transform: [{ scale: 1.05 }], backgroundColor: '#f0c767' }
                    ]}
                  >
                    <Ionicons name="refresh" size={18} color="#000" />
                    <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 14 }}>
                      إعادة المحاولة
                    </Text>
                  </TVFocusable>
                )}
              </View>
            ) : ("""

    if old_desktop_empty in content:
        content = content.replace(old_desktop_empty, new_desktop_empty)

    # 7. Mobile empty state
    old_mobile_empty = """        ) : localSeries.length === 0 ? (
          <View style={styles.centerAll}>
            <Lineicons icon={MonitorBulk} size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12 }]}>{t('no_series')}</Text>
          </View>
        ) : ("""

    new_mobile_empty = """        ) : localSeries.length === 0 ? (
          <View style={styles.centerAll}>
            <Lineicons icon={MonitorBulk} size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12, marginBottom: 16 }]}>
              {isNetworkOnline === false ? 'لا يوجد اتصال بالإنترنت' : t('no_series')}
            </Text>
            {selectedCategory && (
              <TVFocusable
                onPress={() => loadCategory(selectedCategory)}
                style={({ focused }: any) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.gold,
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 8,
                    gap: 8,
                  },
                  focused && { transform: [{ scale: 1.05 }], backgroundColor: '#f0c767' }
                ]}
              >
                <Ionicons name="refresh" size={18} color="#000" />
                <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 14 }}>
                  إعادة المحاولة
                </Text>
              </TVFocusable>
            )}
          </View>
        ) : ("""

    if old_mobile_empty in content:
        content = content.replace(old_mobile_empty, new_mobile_empty)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated series.tsx successfully!")

def update_live():
    path = r"c:\streaming\artifacts\streaming\app\(tabs)\live.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. State
    if "isNetworkOnline" not in content:
        content = content.replace(
            "  const refreshCounter = useAppStore((s) => s.refreshCounter);",
            "  const refreshCounter = useAppStore((s) => s.refreshCounter);\n  const isNetworkOnline = useAppStore((s) => s.isNetworkOnline);"
        )

    # 2. activeRequestId ref
    if "activeRequestId = useRef(0);" not in content:
        content = content.replace(
            "  const [loading, setLoading] = useState(false);",
            "  const [loading, setLoading] = useState(false);\n  const activeRequestId = useRef(0);"
        )

    # 3. loadCategory
    old_load_start = """  const loadCategory = useCallback(async (cat: { id: string; name: string }) => {
    if (!activePlaylistId && cat.id !== '__favorites__' && cat.id !== '__recent__') return;
    setLoading(true);
    setDisplayCount(50);"""

    new_load_start = """  const loadCategory = useCallback(async (cat: { id: string; name: string }) => {
    if (!activePlaylistId && cat.id !== '__favorites__' && cat.id !== '__recent__') return;
    const reqId = ++activeRequestId.current;
    setLoading(true);
    setDisplayCount(50);"""

    if old_load_start in content:
        content = content.replace(old_load_start, new_load_start)

    old_load_end = """    } catch (e) {
      setLocalChannels([]);
    } finally {
      setLoading(false);
    }
  }, [activePlaylistId, getChannelsForCategory, isLargeScreen]);"""

    new_load_end = """    } catch (e) {
      if (activeRequestId.current !== reqId) return;
      setLocalChannels([]);
    } finally {
      if (activeRequestId.current === reqId) {
        setLoading(false);
      }
    }
  }, [activePlaylistId, getChannelsForCategory, isLargeScreen]);

  const handleCategoryPress = useCallback((cat: { id: string; name: string }) => {
    if (cat.id === '__search__') {
      router.push({ pathname: '/search', params: { tab: 'live' } });
    } else if (isParentalLocked(cat.id)) {
      setPendingCategory(cat);
      setPinModalVisible(true);
    } else {
      if (selectedCategory && String(selectedCategory.id) === String(cat.id)) {
        loadCategory(cat);
      } else {
        setSelectedCategory(cat);
      }
    }
  }, [isParentalLocked, selectedCategory, loadCategory]);"""

    if old_load_end in content:
        content = content.replace(old_load_end, new_load_end)

    # 4. Use handleCategoryPress in desktop
    old_desktop_press = """                      onPress={() => {
                        if (item.id === '__search__') {
                          router.push({ pathname: '/search', params: { tab: 'live' } });
                        } else {
                          if (isParentalLocked(item.id)) {
                            setPendingCategory(item);
                            setPinModalVisible(true);
                          } else {
                            setSelectedCategory(item);
                          }
                        }
                      }}"""

    new_desktop_press = """                      onPress={() => {
                        handleCategoryPress(item);
                      }}"""

    if old_desktop_press in content:
        content = content.replace(old_desktop_press, new_desktop_press)

    # 5. Use handleCategoryPress in mobile
    content = content.replace(
        "onPress={() => setSelectedCategory(item)}",
        "onPress={() => handleCategoryPress(item)}"
    )

    # 6. Desktop empty state
    old_desktop_empty = """            {filteredChannels.length === 0 && !loading ? (
              <View style={styles.centerAll}>
                <Lineicons icon={MonitorBulk} size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12 }]}>{t('no_channels')}</Text>
              </View>
            ) : ("""

    new_desktop_empty = """            {filteredChannels.length === 0 && !loading ? (
              <View style={styles.centerAll}>
                <Lineicons icon={MonitorBulk} size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12, marginBottom: 16 }]}>
                  {channelSearch ? t('no_channels') : (isNetworkOnline === false ? 'لا يوجد اتصال بالإنترنت' : t('no_channels'))}
                </Text>
                {selectedCategory && (
                  <TVFocusable
                    onPress={() => loadCategory(selectedCategory)}
                    style={({ focused }: any) => [
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.gold,
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        borderRadius: 8,
                        gap: 8,
                      },
                      focused && { transform: [{ scale: 1.05 }], backgroundColor: '#f0c767' }
                    ]}
                  >
                    <Ionicons name="refresh" size={18} color="#000" />
                    <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 14 }}>
                      إعادة المحاولة
                    </Text>
                  </TVFocusable>
                )}
              </View>
            ) : ("""

    if old_desktop_empty in content:
        content = content.replace(old_desktop_empty, new_desktop_empty)

    # 7. Mobile empty state
    old_mobile_empty = """        ) : filteredChannels.length === 0 ? (
          <View style={styles.centerAll}>
            <Lineicons icon={MonitorBulk} size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12 }]}>No channels found</Text>
          </View>
        ) : ("""

    new_mobile_empty = """        ) : filteredChannels.length === 0 ? (
          <View style={styles.centerAll}>
            <Lineicons icon={MonitorBulk} size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12, marginBottom: 16 }]}>
              {isNetworkOnline === false ? 'لا يوجد اتصال بالإنترنت' : t('no_channels')}
            </Text>
            {selectedCategory && (
              <TVFocusable
                onPress={() => loadCategory(selectedCategory)}
                style={({ focused }: any) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.gold,
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 8,
                    gap: 8,
                  },
                  focused && { transform: [{ scale: 1.05 }], backgroundColor: '#f0c767' }
                ]}
              >
                <Ionicons name="refresh" size={18} color="#000" />
                <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 14 }}>
                  إعادة المحاولة
                </Text>
              </TVFocusable>
            )}
          </View>
        ) : ("""

    if old_mobile_empty in content:
        content = content.replace(old_mobile_empty, new_mobile_empty)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated live.tsx successfully!")

def update_index():
    path = r"c:\streaming\artifacts\streaming\app\(tabs)\index.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    if "refreshCounter" not in content:
        content = content.replace(
            "  const setCachedHomeContent = useAppStore((s) => s.setCachedHomeContent);",
            "  const setCachedHomeContent = useAppStore((s) => s.setCachedHomeContent);\n  const refreshCounter = useAppStore((s) => s.refreshCounter);"
        )

    content = content.replace(
        "}, [activePlaylistId, activeCategories, refreshKey]);",
        "}, [activePlaylistId, activeCategories, refreshKey, refreshCounter]);"
    )

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated index.tsx successfully!")

def update_web_player():
    path = r"c:\streaming\artifacts\streaming\components\WebVideoPlayer.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    old_cleanup = """      return () => {
        console.log('[FRONTEND]: [WebVideoPlayer] Cleanup running for source:', internalSource);"""

    new_online_listener = """      const handleOnline = () => {
        console.log('[WebVideoPlayer] Network connection restored. Auto-recovering player...');
        try {
          if (format === 'hls' || isHls) {
            hlsRetryCount = 0;
            loadHls(internalSource);
          } else if (format === 'mpegts' || isMpegTs) {
            loadMpegTs(internalSource);
          } else {
            loadNative(internalSource);
          }
        } catch (e) {
          console.warn('[WebVideoPlayer] Error on auto-recover:', e);
        }
      };

      if (typeof window !== 'undefined') {
        window.addEventListener('online', handleOnline);
      }

      return () => {
        console.log('[FRONTEND]: [WebVideoPlayer] Cleanup running for source:', internalSource);
        if (typeof window !== 'undefined') {
          window.removeEventListener('online', handleOnline);
        }"""

    if old_cleanup in content and "handleOnline" not in content:
        content = content.replace(old_cleanup, new_online_listener)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated WebVideoPlayer.tsx successfully!")

update_movies()
update_series()
update_live()
update_index()
update_web_player()
