import re

def update_series():
    path = r'c:\streaming\artifacts\streaming\app\(tabs)\series.tsx'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. isTargetMatch and normalizeTitle
    new_match = """const normalizeTitle = (str: string) => {
  return str
    .toLowerCase()
    .replace(/^[a-z]{2,4}\\s*[:|\\-]\\s*/i, '')
    .replace(/\\[.*?\\]/g, '')
    .replace(/\\(.*?\\)/g, '')
    .replace(/\\b(4k|fhd|hd|uhd|hevc|1080p|720p|h264|h265|bluray|web-dl|vod)\\b/gi, '')
    .replace(/[^\\p{L}\\p{N}\\s]/gu, '')
    .replace(/\\s+/g, ' ')
    .trim();
};

const isTargetMatch = (item: any, target: { id?: string | number; name?: string } | null) => {
  if (!item || !target) return false;

  const itemId = String(item.id || '').trim();
  const targetId = String(target.id || '').trim();

  // 1. Direct ID match (highest priority, 100% accurate)
  if (targetId && itemId && (itemId.toLowerCase() === targetId.toLowerCase())) return true;

  // 2. Strip prefix ID match (xt_series_123 vs 123)
  if (targetId && itemId) {
    const cleanItemId = itemId.replace(/^(xt_|)(vod_|series_|live_)/i, '');
    const cleanTargetId = targetId.replace(/^(xt_|)(vod_|series_|live_)/i, '');
    if (cleanItemId && cleanTargetId && cleanItemId === cleanTargetId) return true;
  }

  // 3. Name matching
  const itemTitle = (item.title || item.name || '').trim();
  const targetName = (target.name || '').trim();

  if (targetName && itemTitle) {
    if (itemTitle.toLowerCase() === targetName.toLowerCase()) return true;
    const normItem = normalizeTitle(itemTitle);
    const normTarget = normalizeTitle(targetName);
    if (normItem && normTarget && normItem === normTarget) return true;
  }

  return false;
};"""

    content, n = re.subn(
        r'const isTargetMatch = \([\s\S]*?\n\};',
        lambda m: new_match,
        content
    )
    assert n == 1, f"isTargetMatch replacement count was {n}"

    # 2. scrollAndFocusTarget
    new_scroll = """const scrollAndFocusTarget = useCallback((targetId: string, targetIdx: number, numCols: number) => {
    const row = Math.floor(targetIdx / numCols);
    const rowHeight = numCols >= 3 ? 380 : 240;
    const targetOffset = Math.max(0, (row - 1) * rowHeight);

    if (Platform.OS === 'web') {
      flatListRef.current?.scrollToOffset({ offset: targetOffset, animated: false });
      let attempts = 0;
      const cleanId = String(targetId).replace(/^(xt_|)(vod_|series_|live_)/i, '');
      const timer = setInterval(() => {
        attempts++;
        const el = document.getElementById(`card_${targetId}`) || 
                   document.getElementById(`card_xt_vod_${cleanId}`) ||
                   document.getElementById(`card_xt_series_${cleanId}`) ||
                   document.getElementById(`card_${cleanId}`) ||
                   document.querySelector(`[data-card-id="${targetId}"]`) ||
                   document.querySelector(`[data-card-id="${cleanId}"]`);

        if (el) {
          clearInterval(timer);
          try {
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            const focusable = el.getAttribute('tabindex') !== null ? el : el.querySelector<HTMLElement>('[tabindex], [data-focusable="true"]');
            (focusable || el as HTMLElement)?.focus();
          } catch (e) {}
        } else if (attempts >= 25) {
          clearInterval(timer);
          try {
            flatListRef.current?.scrollToOffset({ offset: Math.max(0, row * rowHeight), animated: true });
          } catch (e) {}
        }
      }, 50);
    } else {
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToIndex({ index: targetIdx, animated: true, viewPosition: 0.5 });
        } catch (e) {
          try {
            flatListRef.current?.scrollToOffset({ offset: Math.max(0, row * rowHeight), animated: true });
          } catch (err) {}
        }
      }, 300);
    }
  }, []);"""

    content, n = re.subn(
        r'const scrollAndFocusTarget\s*=\s*useCallback[\s\S]*?\n  \}, \[\]\);',
        lambda m: new_scroll,
        content
    )
    assert n == 1, f"scrollAndFocusTarget series replacement count was {n}"

    # 3. Inside loadCategory series
    new_load = """if (matchedSeries && mIdx >= 0) {
        setSelectedSeriesId(matchedSeries.id);
        setDisplayCount(Math.max(50, mIdx + 30));
        scrollAndFocusTarget(matchedSeries.id, mIdx, rawNumColumns);
        pendingTargetRef.current = null;
        router.setParams({ focusId: '', focusName: '' });
      }"""

    content, n = re.subn(
        r'if \(matchedSeries && mIdx >= 0\) \{[\s\S]*?pendingTargetRef\.current = null;\s*\}',
        lambda m: new_load,
        content
    )
    assert n == 1, f"loadCategory series replacement count was {n}"

    # 4. Category param switch series
    new_cat = """if (targetCat) {
        if (seriesSearch) setSeriesSearch('');
        const isSameCategory = selectedCategory && String(selectedCategory.id) === String(targetCat.id);
        if (!isSameCategory) {
          setLocalSeries([]);
          setSelectedCategory(targetCat);
        } else {
          loadCategory(targetCat);
        }
        const catIdx = categories.findIndex(c => String(c.id) === String(targetCat.id));
        if (catIdx >= 0) {
          setTimeout(() => {
            try {
              categoryListRef.current?.scrollToIndex({ index: catIdx, animated: true, viewPosition: 0.5 });
            } catch (e) {
              categoryListRef.current?.scrollToOffset({ offset: Math.max(0, (catIdx - 2) * 48), animated: true });
            }
          }, 250);
        }
        router.setParams({ categoryId: '', categoryName: '' });
      }"""

    content, n = re.subn(
        r'if \(targetCat\) \{[\s\S]*?router\.setParams\(\{ categoryId: \'\', categoryName: \'\' \}\);\s*\}',
        lambda m: new_cat,
        content
    )
    assert n == 1, f"category param series replacement count was {n}"

    # 5. isItemFocused in both FlatLists series
    new_focus = """const isItemFocused = Boolean(
                    selectedSeriesId && (
                      String(item.id) === String(selectedSeriesId) ||
                      isTargetMatch(item, { id: selectedSeriesId })
                    )
                  );"""

    content, n = re.subn(
        r'const isItemFocused = Boolean\(\s*\(selectedSeriesId && isTargetMatch\(item, \{ id: selectedSeriesId \}\)\) \|\|[\s\S]*?\);',
        lambda m: new_focus,
        content
    )
    assert n == 2, f"isItemFocused series replacement count was {n}"

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("series.tsx successfully updated!")

if __name__ == '__main__':
    update_series()
