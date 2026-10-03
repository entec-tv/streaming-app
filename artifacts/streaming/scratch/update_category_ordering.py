import os

def update_live():
    path = r'c:\streaming\artifacts\streaming\app\(tabs)\live.tsx'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add updateCategoryPreferences
    old_store = "const categoryPreferences = useAppStore(s => s.categoryPreferences);"
    new_store = ("const categoryPreferences = useAppStore(s => s.categoryPreferences);\n"
                 "  const updateCategoryPreferences = useAppStore(s => s.updateCategoryPreferences);")
    if old_store in content and "updateCategoryPreferences" not in content:
        content = content.replace(old_store, new_store, 1)

    # 2. Update orderedLiveCats to use String matching
    old_ordered = """  const orderedLiveCats = useMemo(() => {
    if (!activeCategories?.live) return [];
    
    let filtered = activeCategories.live.filter((c: any) => 
      !prefs.hiddenIds.includes(c.id) && 
      !c.name.toLowerCase().includes('remote search')
    );
    
    if (prefs.liveOrder && prefs.liveOrder.length > 0) {
      const orderMap = new Map<string, number>(prefs.liveOrder.map((id, index) => [id, index]));
      filtered.sort((a: any, b: any) => {
        const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999999;
        const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999999;
        return idxA - idxB;
      });
    }
    return filtered;
  }, [activeCategories?.live, prefs]);"""

    new_ordered = """  const orderedLiveCats = useMemo(() => {
    if (!activeCategories?.live) return [];
    
    const hiddenSet = new Set((prefs.hiddenIds || []).map(String));
    let filtered = activeCategories.live.filter((c: any) => 
      !hiddenSet.has(String(c.id)) && 
      !c.name.toLowerCase().includes('remote search')
    );
    
    if (prefs.liveOrder && prefs.liveOrder.length > 0) {
      const orderMap = new Map<string, number>(prefs.liveOrder.map((id, index) => [String(id), index]));
      filtered.sort((a: any, b: any) => {
        const idxA = orderMap.has(String(a.id)) ? orderMap.get(String(a.id))! : 999999;
        const idxB = orderMap.has(String(b.id)) ? orderMap.get(String(b.id))! : 999999;
        return idxA - idxB;
      });
    }
    return filtered;
  }, [activeCategories?.live, prefs]);"""

    # Normalize newlines for replacement
    content_nl = content.replace('\r\n', '\n')
    old_ordered_nl = old_ordered.replace('\r\n', '\n')
    new_ordered_nl = new_ordered.replace('\r\n', '\n')
    if old_ordered_nl in content_nl:
        content_nl = content_nl.replace(old_ordered_nl, new_ordered_nl, 1)

    # 3. Add moveCategory
    old_move_comment = "  // Category reordering is now handled in settings > manage categories"
    new_move_category = """  const moveCategory = (direction: 'up' | 'down') => {
    if (!activePlaylistId) return;

    let targetCat = selectedCategory;
    if (!targetCat || targetCat.id.startsWith('__')) {
      if (selectedChannel) {
        const found = orderedLiveCats.find(
          c => String(c.id) === String((selectedChannel as any).category_id) || c.name === selectedChannel.category
        );
        if (found) targetCat = found;
      }
    }

    if (!targetCat || targetCat.id.startsWith('__')) return;

    const hiddenSet = new Set((prefs.hiddenIds || []).map(String));
    let currentList = (activeCategories?.live || []).filter((c: any) => 
      !hiddenSet.has(String(c.id)) && 
      !c.name.toLowerCase().includes('remote search')
    );

    if (prefs.liveOrder && prefs.liveOrder.length > 0) {
      const orderMap = new Map<string, number>(prefs.liveOrder.map((id, index) => [String(id), index]));
      currentList.sort((a: any, b: any) => {
        const idxA = orderMap.has(String(a.id)) ? orderMap.get(String(a.id))! : 999999;
        const idxB = orderMap.has(String(b.id)) ? orderMap.get(String(b.id))! : 999999;
        return idxA - idxB;
      });
    }

    const index = currentList.findIndex((c: any) => String(c.id) === String(targetCat!.id));
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === currentList.length - 1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = currentList[index];
    currentList[index] = currentList[swapIndex];
    currentList[swapIndex] = temp;

    const newOrder = currentList.map((c: any) => String(c.id));
    updateCategoryPreferences(activePlaylistId, { liveOrder: newOrder });

    if (!selectedCategory || selectedCategory.id.startsWith('__') || String(selectedCategory.id) !== String(targetCat.id)) {
      setSelectedCategory(targetCat);
    }
  };"""

    if old_move_comment in content_nl:
        content_nl = content_nl.replace(old_move_comment, new_move_category, 1)

    # 4. In player bottom controls, replace moveChannel with moveCategory
    old_buttons = """                    {selectedCategory && selectedCategory.id !== '__favorites__' && selectedCategory.id !== '__recent__' && !channelSearch && (
                      <>
                        <TVFocusable
                          onPress={() => moveChannel('up')}
                          style={({ focused }: any) => [
                            styles.tvFavoriteBtn,
                            { backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: colors.border, marginTop: 0, paddingHorizontal: 16 }
                          ]}
                        >
                          {({ focused }: any) => (
                            <Ionicons name="chevron-up" size={22} color={focused ? '#000' : colors.text} />
                          )}
                        </TVFocusable>

                        <TVFocusable
                          onPress={() => moveChannel('down')}
                          style={({ focused }: any) => [
                            styles.tvFavoriteBtn,
                            { backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: colors.border, marginTop: 0, paddingHorizontal: 16 }
                          ]}
                        >
                          {({ focused }: any) => (
                            <Ionicons name="chevron-down" size={22} color={focused ? '#000' : colors.text} />
                          )}
                        </TVFocusable>
                      </>
                    )}"""

    new_buttons = """                    {Boolean((selectedCategory && !selectedCategory.id.startsWith('__')) || (selectedChannel && ((selectedChannel as any).category_id || selectedChannel.category))) && !categorySearch && (
                      <>
                        <TVFocusable
                          onPress={() => moveCategory('up')}
                          style={({ focused }: any) => [
                            styles.tvFavoriteBtn,
                            { backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: colors.border, marginTop: 0, paddingHorizontal: 16 }
                          ]}
                        >
                          {({ focused }: any) => (
                            <Ionicons name="chevron-up" size={22} color={focused ? '#000' : colors.text} />
                          )}
                        </TVFocusable>

                        <TVFocusable
                          onPress={() => moveCategory('down')}
                          style={({ focused }: any) => [
                            styles.tvFavoriteBtn,
                            { backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: colors.border, marginTop: 0, paddingHorizontal: 16 }
                          ]}
                        >
                          {({ focused }: any) => (
                            <Ionicons name="chevron-down" size={22} color={focused ? '#000' : colors.text} />
                          )}
                        </TVFocusable>
                      </>
                    )}"""

    old_buttons_nl = old_buttons.replace('\r\n', '\n')
    new_buttons_nl = new_buttons.replace('\r\n', '\n')
    if old_buttons_nl in content_nl:
        content_nl = content_nl.replace(old_buttons_nl, new_buttons_nl, 1)

    # 5. Add mobile category arrows
    old_mobile_hdr = """          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.title, { color: colors.text, fontSize: isLandscape ? 18 : 20 }]} numberOfLines={1}>
              {selectedCategory.name}
            </Text>
            <Text style={[styles.count, { color: colors.mutedForeground, fontSize: isLandscape ? 11 : 13 }]}>
              {filteredChannels.length.toLocaleString()} channels
            </Text>
          </View>
        </View>"""

    new_mobile_hdr = """          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.title, { color: colors.text, fontSize: isLandscape ? 18 : 20 }]} numberOfLines={1}>
              {selectedCategory.name}
            </Text>
            <Text style={[styles.count, { color: colors.mutedForeground, fontSize: isLandscape ? 11 : 13 }]}>
              {filteredChannels.length.toLocaleString()} channels
            </Text>
          </View>
          {selectedCategory && !selectedCategory.id.startsWith('__') && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 8 }}>
              <TVFocusable
                onPress={() => moveCategory('up')}
                style={({ focused }: any) => [
                  styles.tvFavoriteBtn,
                  { backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: colors.border, marginTop: 0, paddingHorizontal: 10, paddingVertical: 6 }
                ]}
              >
                {({ focused }: any) => (
                  <Ionicons name="chevron-up" size={18} color={focused ? '#000' : colors.text} />
                )}
              </TVFocusable>
              <TVFocusable
                onPress={() => moveCategory('down')}
                style={({ focused }: any) => [
                  styles.tvFavoriteBtn,
                  { backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: colors.border, marginTop: 0, paddingHorizontal: 10, paddingVertical: 6 }
                ]}
              >
                {({ focused }: any) => (
                  <Ionicons name="chevron-down" size={18} color={focused ? '#000' : colors.text} />
                )}
              </TVFocusable>
            </View>
          )}
        </View>"""

    old_mobile_hdr_nl = old_mobile_hdr.replace('\r\n', '\n')
    new_mobile_hdr_nl = new_mobile_hdr.replace('\r\n', '\n')
    if old_mobile_hdr_nl in content_nl:
        content_nl = content_nl.replace(old_mobile_hdr_nl, new_mobile_hdr_nl, 1)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content_nl)
    print("live.tsx updated successfully!")

def update_movies():
    path = r'c:\streaming\artifacts\streaming\app\(tabs)\movies.tsx'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    content_nl = content.replace('\r\n', '\n')

    # Update finalVodCats
    old_final = """  const finalVodCats = useMemo(() => {
    if (!activeCategories?.vod) return [];
    
    let filtered = activeCategories.vod.filter((c: any) => !prefs.hiddenIds.includes(c.id));
    
    if (prefs.vodOrder && prefs.vodOrder.length > 0) {
      const orderMap = new Map<string, number>(prefs.vodOrder.map((id, index) => [id, index]));
      filtered.sort((a: any, b: any) => {
        const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999999;
        const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999999;
        return idxA - idxB;
      });
    }
    return filtered;
  }, [activeCategories?.vod, prefs]);"""

    new_final = """  const finalVodCats = useMemo(() => {
    if (!activeCategories?.vod) return [];
    
    const hiddenSet = new Set((prefs.hiddenIds || []).map(String));
    let filtered = activeCategories.vod.filter((c: any) => !hiddenSet.has(String(c.id)));
    
    if (prefs.vodOrder && prefs.vodOrder.length > 0) {
      const orderMap = new Map<string, number>(prefs.vodOrder.map((id, index) => [String(id), index]));
      filtered.sort((a: any, b: any) => {
        const idxA = orderMap.has(String(a.id)) ? orderMap.get(String(a.id))! : 999999;
        const idxB = orderMap.has(String(b.id)) ? orderMap.get(String(b.id))! : 999999;
        return idxA - idxB;
      });
    }
    return filtered;
  }, [activeCategories?.vod, prefs]);"""

    old_final_nl = old_final.replace('\r\n', '\n')
    new_final_nl = new_final.replace('\r\n', '\n')
    if old_final_nl in content_nl:
        content_nl = content_nl.replace(old_final_nl, new_final_nl, 1)

    # Update moveCategory
    old_move = """  const moveCategory = (direction: 'up' | 'down') => {
    if (!selectedCategory || selectedCategory.id.startsWith('__')) return;
    
    let currentList = activeCategories?.vod?.filter((c: any) => !prefs.hiddenIds.includes(c.id)) || [];
    if (prefs.vodOrder && prefs.vodOrder.length > 0) {
      const orderMap = new Map<string, number>(prefs.vodOrder.map((id, index) => [id, index]));
      currentList.sort((a: any, b: any) => {
        const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999999;
        const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999999;
        return idxA - idxB;
      });
    }

    const index = currentList.findIndex((c: any) => c.id === selectedCategory.id);
    if (index === -1) return;
    
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === currentList.length - 1) return;
    
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = currentList[index];
    currentList[index] = currentList[swapIndex];
    currentList[swapIndex] = temp;

    const newOrder = currentList.map((c: any) => c.id);
    updateCategoryPreferences(activePlaylistId, { vodOrder: newOrder });
  };"""

    new_move = """  const moveCategory = (direction: 'up' | 'down') => {
    if (!selectedCategory || selectedCategory.id.startsWith('__')) return;
    if (!activePlaylistId) return;

    const hiddenSet = new Set((prefs.hiddenIds || []).map(String));
    let currentList = (activeCategories?.vod || []).filter((c: any) => !hiddenSet.has(String(c.id)));
    if (prefs.vodOrder && prefs.vodOrder.length > 0) {
      const orderMap = new Map<string, number>(prefs.vodOrder.map((id, index) => [String(id), index]));
      currentList.sort((a: any, b: any) => {
        const idxA = orderMap.has(String(a.id)) ? orderMap.get(String(a.id))! : 999999;
        const idxB = orderMap.has(String(b.id)) ? orderMap.get(String(b.id))! : 999999;
        return idxA - idxB;
      });
    }

    const index = currentList.findIndex((c: any) => String(c.id) === String(selectedCategory.id));
    if (index === -1) return;
    
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === currentList.length - 1) return;
    
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = currentList[index];
    currentList[index] = currentList[swapIndex];
    currentList[swapIndex] = temp;

    const newOrder = currentList.map((c: any) => String(c.id));
    updateCategoryPreferences(activePlaylistId, { vodOrder: newOrder });
  };"""

    old_move_nl = old_move.replace('\r\n', '\n')
    new_move_nl = new_move.replace('\r\n', '\n')
    if old_move_nl in content_nl:
        content_nl = content_nl.replace(old_move_nl, new_move_nl, 1)

    # Add mobile category arrows
    old_mobile_hdr = """          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.title, { color: colors.text, fontSize: isLandscape ? 18 : 22 }]} numberOfLines={isLandscape ? 1 : 2}>
              {selectedCategory.name}
            </Text>
            {selectedCategory.id !== '__all__' && (
              <Text style={[styles.count, { color: colors.mutedForeground, fontSize: isLandscape ? 11 : 13 }]}>
                {localMovies.length.toLocaleString()} {t('count_movies')}
              </Text>
            )}
          </View>
        </View>"""

    new_mobile_hdr = """          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.title, { color: colors.text, fontSize: isLandscape ? 18 : 22 }]} numberOfLines={isLandscape ? 1 : 2}>
              {selectedCategory.name}
            </Text>
            {selectedCategory.id !== '__all__' && (
              <Text style={[styles.count, { color: colors.mutedForeground, fontSize: isLandscape ? 11 : 13 }]}>
                {localMovies.length.toLocaleString()} {t('count_movies')}
              </Text>
            )}
          </View>
          {selectedCategory && !selectedCategory.id.startsWith('__') && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 8 }}>
              <TVFocusable
                onPress={() => moveCategory('up')}
                style={({ focused }: any) => [
                  styles.tvFavoriteBtn,
                  { backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: colors.border, marginTop: 0, paddingHorizontal: 10, paddingVertical: 6 }
                ]}
              >
                {({ focused }: any) => (
                  <Ionicons name="chevron-up" size={18} color={focused ? '#000' : colors.text} />
                )}
              </TVFocusable>
              <TVFocusable
                onPress={() => moveCategory('down')}
                style={({ focused }: any) => [
                  styles.tvFavoriteBtn,
                  { backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: colors.border, marginTop: 0, paddingHorizontal: 10, paddingVertical: 6 }
                ]}
              >
                {({ focused }: any) => (
                  <Ionicons name="chevron-down" size={18} color={focused ? '#000' : colors.text} />
                )}
              </TVFocusable>
            </View>
          )}
        </View>"""

    old_mobile_hdr_nl = old_mobile_hdr.replace('\r\n', '\n')
    new_mobile_hdr_nl = new_mobile_hdr.replace('\r\n', '\n')
    if old_mobile_hdr_nl in content_nl:
        content_nl = content_nl.replace(old_mobile_hdr_nl, new_mobile_hdr_nl, 1)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content_nl)
    print("movies.tsx updated successfully!")

def update_series():
    path = r'c:\streaming\artifacts\streaming\app\(tabs)\series.tsx'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    content_nl = content.replace('\r\n', '\n')

    # Update categories useMemo in series.tsx
    old_cats = """  const categories = useMemo(() => {
    if (!activeCategories?.series) return [];
    let filtered = activeCategories.series.filter((c: any) => !prefs.hiddenIds.includes(c.id));
    if (prefs.seriesOrder && prefs.seriesOrder.length > 0) {
      const orderMap = new Map<string, number>(prefs.seriesOrder.map((id, index) => [id, index]));
      filtered.sort((a: any, b: any) => {
        const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999999;
        const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999999;
        return idxA - idxB;
      });
    }
    const SPECIAL_CATEGORIES = [
      { id: '__all__', name: t('all') || 'All' },
      { id: '__recent__', name: t('continue_watching') || 'Continue Watching' },
      { id: '__favorites__', name: t('favorites') || 'Favorites' }
    ];
    return [...SPECIAL_CATEGORIES, ...filtered];
  }, [activeCategories?.series, prefs, t]);"""

    new_cats = """  const categories = useMemo(() => {
    if (!activeCategories?.series) return [];
    const hiddenSet = new Set((prefs.hiddenIds || []).map(String));
    let filtered = activeCategories.series.filter((c: any) => !hiddenSet.has(String(c.id)));
    if (prefs.seriesOrder && prefs.seriesOrder.length > 0) {
      const orderMap = new Map<string, number>(prefs.seriesOrder.map((id, index) => [String(id), index]));
      filtered.sort((a: any, b: any) => {
        const idxA = orderMap.has(String(a.id)) ? orderMap.get(String(a.id))! : 999999;
        const idxB = orderMap.has(String(b.id)) ? orderMap.get(String(b.id))! : 999999;
        return idxA - idxB;
      });
    }
    const SPECIAL_CATEGORIES = [
      { id: '__all__', name: t('all') || 'All' },
      { id: '__recent__', name: t('continue_watching') || 'Continue Watching' },
      { id: '__favorites__', name: t('favorites') || 'Favorites' }
    ];
    return [...SPECIAL_CATEGORIES, ...filtered];
  }, [activeCategories?.series, prefs, t]);"""

    old_cats_nl = old_cats.replace('\r\n', '\n')
    new_cats_nl = new_cats.replace('\r\n', '\n')
    if old_cats_nl in content_nl:
        content_nl = content_nl.replace(old_cats_nl, new_cats_nl, 1)

    # Update moveCategory in series.tsx
    old_move = """  const moveCategory = (direction: 'up' | 'down') => {
    if (!selectedCategory || selectedCategory.id.startsWith('__')) return;
    
    let currentList = activeCategories?.series?.filter((c: any) => !prefs.hiddenIds.includes(c.id)) || [];
    if (prefs.seriesOrder && prefs.seriesOrder.length > 0) {
      const orderMap = new Map<string, number>(prefs.seriesOrder.map((id, index) => [id, index]));
      currentList.sort((a: any, b: any) => {
        const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 999999;
        const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 999999;
        return idxA - idxB;
      });
    }

    const index = currentList.findIndex((c: any) => c.id === selectedCategory.id);
    if (index === -1) return;
    
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === currentList.length - 1) return;
    
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = currentList[index];
    currentList[index] = currentList[swapIndex];
    currentList[swapIndex] = temp;

    const newOrder = currentList.map((c: any) => c.id);
    updateCategoryPreferences(activePlaylistId, { seriesOrder: newOrder });
  };"""

    new_move = """  const moveCategory = (direction: 'up' | 'down') => {
    if (!selectedCategory || selectedCategory.id.startsWith('__')) return;
    if (!activePlaylistId) return;

    const hiddenSet = new Set((prefs.hiddenIds || []).map(String));
    let currentList = (activeCategories?.series || []).filter((c: any) => !hiddenSet.has(String(c.id)));
    if (prefs.seriesOrder && prefs.seriesOrder.length > 0) {
      const orderMap = new Map<string, number>(prefs.seriesOrder.map((id, index) => [String(id), index]));
      currentList.sort((a: any, b: any) => {
        const idxA = orderMap.has(String(a.id)) ? orderMap.get(String(a.id))! : 999999;
        const idxB = orderMap.has(String(b.id)) ? orderMap.get(String(b.id))! : 999999;
        return idxA - idxB;
      });
    }

    const index = currentList.findIndex((c: any) => String(c.id) === String(selectedCategory.id));
    if (index === -1) return;
    
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === currentList.length - 1) return;
    
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = currentList[index];
    currentList[index] = currentList[swapIndex];
    currentList[swapIndex] = temp;

    const newOrder = currentList.map((c: any) => String(c.id));
    updateCategoryPreferences(activePlaylistId, { seriesOrder: newOrder });
  };"""

    old_move_nl = old_move.replace('\r\n', '\n')
    new_move_nl = new_move.replace('\r\n', '\n')
    if old_move_nl in content_nl:
        content_nl = content_nl.replace(old_move_nl, new_move_nl, 1)

    # Add mobile category arrows
    old_mobile_hdr = """          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.title, { color: colors.text, fontSize: isLandscape ? 18 : 22 }]} numberOfLines={isLandscape ? 1 : 2}>
              {selectedCategory.name}
            </Text>
            {selectedCategory.id !== '__all__' && (
              <Text style={[styles.count, { color: colors.mutedForeground, fontSize: isLandscape ? 11 : 13 }]}>
                {localSeries.length.toLocaleString()} {t('count_series')}
              </Text>
            )}
          </View>
        </View>"""

    new_mobile_hdr = """          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.title, { color: colors.text, fontSize: isLandscape ? 18 : 22 }]} numberOfLines={isLandscape ? 1 : 2}>
              {selectedCategory.name}
            </Text>
            {selectedCategory.id !== '__all__' && (
              <Text style={[styles.count, { color: colors.mutedForeground, fontSize: isLandscape ? 11 : 13 }]}>
                {localSeries.length.toLocaleString()} {t('count_series')}
              </Text>
            )}
          </View>
          {selectedCategory && !selectedCategory.id.startsWith('__') && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 8 }}>
              <TVFocusable
                onPress={() => moveCategory('up')}
                style={({ focused }: any) => [
                  styles.tvFavoriteBtn,
                  { backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: colors.border, marginTop: 0, paddingHorizontal: 10, paddingVertical: 6 }
                ]}
              >
                {({ focused }: any) => (
                  <Ionicons name="chevron-up" size={18} color={focused ? '#000' : colors.text} />
                )}
              </TVFocusable>
              <TVFocusable
                onPress={() => moveCategory('down')}
                style={({ focused }: any) => [
                  styles.tvFavoriteBtn,
                  { backgroundColor: focused ? colors.gold : 'rgba(255,255,255,0.05)', borderColor: colors.border, marginTop: 0, paddingHorizontal: 10, paddingVertical: 6 }
                ]}
              >
                {({ focused }: any) => (
                  <Ionicons name="chevron-down" size={18} color={focused ? '#000' : colors.text} />
                )}
              </TVFocusable>
            </View>
          )}
        </View>"""

    old_mobile_hdr_nl = old_mobile_hdr.replace('\r\n', '\n')
    new_mobile_hdr_nl = new_mobile_hdr.replace('\r\n', '\n')
    if old_mobile_hdr_nl in content_nl:
        content_nl = content_nl.replace(old_mobile_hdr_nl, new_mobile_hdr_nl, 1)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content_nl)
    print("series.tsx updated successfully!")

if __name__ == '__main__':
    update_live()
    update_movies()
    update_series()
