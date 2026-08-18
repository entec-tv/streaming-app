import re

with open('c:/streaming/artifacts/streaming/app/(tabs)/movies.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add AsyncStorage import
content = content.replace("import { useAppStore } from '@/store/app-store';", "import { useAppStore } from '@/store/app-store';\nimport AsyncStorage from '@react-native-async-storage/async-storage';")

# 2. Remove categorySearch state and add orderedVodCats state
state_search = r"const \[categorySearch, setCategorySearch\] = useState\(''\);"
state_replace = "const [orderedVodCats, setOrderedVodCats] = useState<any[]>([]);"
content = re.sub(state_search, state_replace, content)

# 3. Add useEffect for loading ordered categories and moveCategory function
loading_logic = """
  useEffect(() => {
    if (activeCategories?.vod) {
      AsyncStorage.getItem(`cat_order_${activePlaylistId}_vod`).then(orderStr => {
        if (orderStr) {
          try {
            const orderArr = JSON.parse(orderStr);
            const orderMap = new Map<string, number>(orderArr.map((id: string, index: number) => [id, index]));
            const sorted = [...activeCategories.vod].sort((a: any, b: any) => {
              const idxA = orderMap.has(a.id) ? (orderMap.get(a.id) as number) : 999999;
              const idxB = orderMap.has(b.id) ? (orderMap.get(b.id) as number) : 999999;
              return idxA - idxB;
            });
            setOrderedVodCats(sorted);
          } catch(e) {
            setOrderedVodCats(activeCategories.vod);
          }
        } else {
          setOrderedVodCats(activeCategories.vod);
        }
      }).catch(() => {
        setOrderedVodCats(activeCategories.vod);
      });
    } else {
      setOrderedVodCats([]);
    }
  }, [activeCategories?.vod, activePlaylistId]);

  const moveCategory = async (direction: 'up' | 'down') => {
    if (!selectedCategory || selectedCategory.id.startsWith('__')) return;

    const currentIndex = orderedVodCats.findIndex(c => c.id === selectedCategory.id);
    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === orderedVodCats.length - 1) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const newCats = [...orderedVodCats];
    const temp = newCats[currentIndex];
    newCats[currentIndex] = newCats[swapIndex];
    newCats[swapIndex] = temp;

    setOrderedVodCats(newCats);
    
    try {
      const newOrder = newCats.map(c => c.id);
      await AsyncStorage.setItem(`cat_order_${activePlaylistId}_vod`, JSON.stringify(newOrder));
    } catch (e) {
      console.error("Failed to save custom category order:", e);
    }
  };
"""
content = content.replace("const [showCategoryKeyboard, setShowCategoryKeyboard] = useState(false);", "const [showCategoryKeyboard, setShowCategoryKeyboard] = useState(false);\n" + loading_logic)

# 4. Use orderedVodCats instead of activeCategories?.vod
content = content.replace("...(activeCategories?.vod || [])", "...(orderedVodCats || [])")

# 5. Remove filteredCategories and use categories
content = re.sub(r"const filteredCategories = useMemo\(\(\) => \{[\s\S]*?\}, \[categories, categorySearch\]\);", "", content)
content = content.replace("data={filteredCategories}", "data={categories}")

# 6. Replace TV searchBox with arrows
tv_search = r"<View style=\{styles\.tvHeader\}>[\s\S]*?</View>\n\s*</View>\n\s*<View style=\{\{ flex: 1 \}\}>"
tv_header_replacement = """<View style={[styles.tvHeader, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <Text style={[styles.tvTitle, { color: colors.text }]}>Movies</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TVFocusable onPress={() => moveCategory('up')} style={({ focused }: any) => [{ padding: 6, borderRadius: 8, backgroundColor: focused ? colors.gold : 'transparent' }]}>
                  {({ focused }: any) => <Ionicons name="chevron-up" size={20} color={focused ? '#000' : colors.text} />}
                </TVFocusable>
                <TVFocusable onPress={() => moveCategory('down')} style={({ focused }: any) => [{ padding: 6, borderRadius: 8, backgroundColor: focused ? colors.gold : 'transparent' }]}>
                  {({ focused }: any) => <Ionicons name="chevron-down" size={20} color={focused ? '#000' : colors.text} />}
                </TVFocusable>
              </View>
            </View>
            <View style={{ flex: 1 }}>"""
content = re.sub(tv_search, tv_header_replacement, content)

# 7. Remove mobile search container
mobile_search = r"<View style=\{styles\.mobileSearchContainer\}>[\s\S]*?</View>"
content = re.sub(mobile_search, "", content)

# 8. Add arrows to mobile view
mobile_header = r"(<View style=\{\{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 \}\}>\s*<Text style=\{styles\.mobileTitle\}>Movies</Text>\s*)<\/View>"
mobile_header_replacement = r"\1<View style={{ flexDirection: 'row', gap: 12 }}>\n          <Pressable onPress={() => moveCategory('up')} style={{ padding: 8, backgroundColor: colors.surface, borderRadius: 8 }}>\n            <Ionicons name=\"chevron-back\" size={20} color={colors.text} />\n          </Pressable>\n          <Pressable onPress={() => moveCategory('down')} style={{ padding: 8, backgroundColor: colors.surface, borderRadius: 8 }}>\n            <Ionicons name=\"chevron-forward\" size={20} color={colors.text} />\n          </Pressable>\n        </View>\n      </View>"
content = re.sub(mobile_header, mobile_header_replacement, content)


with open('c:/streaming/artifacts/streaming/app/(tabs)/movies.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
