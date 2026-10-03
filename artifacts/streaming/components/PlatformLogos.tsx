import React from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Image } from 'expo-image';

export function PlatformLogos({ isCompact = false }: { isCompact?: boolean }) {
  const scale = isCompact ? 0.85 : 1.0;

  return (
    <View style={styles.container}>
      {/* 1. Samsung: White Oval Badge with Clear Bold Black SAMSUNG text */}
      <View style={styles.itemWrapper}>
        <View
          style={[
            styles.samsungBadge,
            {
              paddingHorizontal: 11 * scale,
              paddingVertical: 3 * scale,
              height: 25 * scale,
              borderRadius: 13 * scale,
              transform: [{ rotate: '-4deg' }],
            },
          ]}
        >
          <Text
            style={[
              styles.samsungText,
              {
                fontSize: 11 * scale,
                letterSpacing: 0.8 * scale,
              },
            ]}
          >
            SAMSUNG
          </Text>
        </View>
      </View>

      {/* 2. LG webOS: Authentic Red Circle with smiley face + LG + webOS */}
      <View style={[styles.itemWrapper, { flexDirection: 'row', alignItems: 'center', gap: 5 * scale }]}>
        <Svg width={23 * scale} height={23 * scale} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="11.5" fill="#A50034" />
          <Circle cx="7.2" cy="9.5" r="1.3" fill="#FFFFFF" />
          <Path
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 7.5v7.5h4.5 M18.5 12a6.5 6.5 0 1 1-1.8-4.5"
          />
        </Svg>
        <View style={{ justifyContent: 'center' }}>
          <Text style={[styles.lgText, { fontSize: 13 * scale, lineHeight: 14 * scale }]}>LG</Text>
          <Text style={[styles.webosText, { fontSize: 9.5 * scale, lineHeight: 10.5 * scale }]}>
            web<Text style={{ color: '#8E959E' }}>OS</Text>
          </Text>
        </View>
      </View>

      {/* 3. Windows: Official 4-tiles Microsoft Windows Vector Logo */}
      <View style={styles.itemWrapper}>
        <Svg width={23 * scale} height={23 * scale} viewBox="0 0 24 24">
          <Path
            fill="#00ADEF"
            d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.949-1.951"
          />
        </Svg>
      </View>

      {/* 4. Roku: Official Purple Roku Wordmark Vector */}
      <View style={styles.itemWrapper}>
        <Svg width={58 * scale} height={23 * scale} viewBox="0 0 24 24">
          <Path
            fill="#662D91"
            d="M16.34 9.853l-2.254 2.254v-2.26H12.13v5.744h1.957v-2.33l2.353 2.33h2.46l-2.988-2.99 2.477-2.476v3.411c0 1.133.679 2.177 2.393 2.177.815 0 1.56-.462 1.922-.88l.88.759H24v-5.74h-1.951v3.718c-.22.384-.528.627-1.002.627-.482 0-.703-.286-.703-1.198V9.853zm-4.591 2.869A3.004 3.004 0 1 1 8.738 9.73a2.997 2.997 0 0 1 3.011 2.99m-3.011-1.57c-.518 0-.956.704-.956 1.572 0 .867.438 1.57.956 1.57.528 0 .968-.702.968-1.57 0-.869-.438-1.572-.968-1.572zm-2.206 4.447H4.313L2.55 13.153h-.594v2.44H0V8.26h2.8c1.616 0 2.935 1.1 2.935 2.45 0 .826-.505 1.562-1.273 2.013l2.07 2.875m-2.75-4.888A1.226 1.226 0 0 0 2.56 9.478h-.604v2.453h.605a1.225 1.225 0 0 0 1.22-1.221Z"
          />
        </Svg>
      </View>

      {/* 5. Apple TV: Official White Apple Silhouette + tv */}
      <View style={styles.itemWrapper}>
        <Svg width={46 * scale} height={21 * scale} viewBox="0 0 24 24">
          <Path
            fill="#FFFFFF"
            d="M20.57 17.735h-1.815l-3.34-9.203h1.633l2.02 5.987c.075.231.273.9.586 2.012l.297-.997.33-1.006 2.094-6.004H24zm-5.344-.066a5.76 5.76 0 0 1-1.55.207c-1.23 0-1.84-.693-1.84-2.087V9.646h-1.063V8.532h1.121V7.081l1.476-.602v2.062h1.707v1.113H13.38v5.805c0 .446.074.75.214.932.14.182.396.264.75.264.207 0 .495-.041.883-.115zm-7.29-5.343c.017 1.764 1.55 2.358 1.567 2.366-.017.042-.248.842-.808 1.658-.487.71-.99 1.418-1.79 1.435-.783.016-1.03-.462-1.93-.462-.89 0-1.17.445-1.913.478-.758.025-1.344-.775-1.838-1.484-.998-1.451-1.765-4.098-.734-5.88.51-.89 1.426-1.451 2.416-1.46.75-.016 1.468.512 1.93.512.461 0 1.327-.627 2.234-.536.38.016 1.452.157 2.136 1.154-.058.033-1.278.743-1.27 2.219M6.468 7.988c.404-.495.685-1.18.61-1.864-.585.025-1.294.388-1.723.883-.38.437-.71 1.138-.619 1.806.652.05 1.328-.338 1.732-.825Z"
          />
        </Svg>
      </View>

      {/* 6. Android: Official Android Robot Mascot */}
      <View style={styles.itemWrapper}>
        <Image
          source={require('@/assets/images/platforms/android_real.png')}
          style={{ width: 23 * scale, height: 27 * scale }}
          contentFit="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginVertical: 12,
  },
  itemWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  samsungBadge: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  samsungText: {
    color: '#000000',
    fontWeight: '900',
    textAlign: 'center',
    fontFamily: Platform.OS === 'web' ? 'Arial Black, sans-serif' : undefined,
  },
  lgText: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  webosText: {
    color: '#C30036',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
