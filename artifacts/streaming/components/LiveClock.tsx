import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export function LiveClock() {
  const colors = useColors();
  const [date, setDate] = useState(new Date());
  const [location, setLocation] = useState('Local');
  const [temp, setTemp] = useState('-- °C');

  useEffect(() => {
    const timer = setInterval(() => setDate(new Date()), 1000);
    
    // Fetch real IP-based location and weather
    fetch('http://ip-api.com/json')
      .then(res => res.json())
      .then(data => {
        if (data && data.city && data.countryCode) {
          setLocation(`${data.city}, ${data.countryCode}`);
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${data.lat}&longitude=${data.lon}&current_weather=true`)
            .then(r => r.json())
            .then(w => {
              if (w?.current_weather?.temperature) {
                setTemp(`${w.current_weather.temperature} °C`);
              }
            }).catch(() => {});
        }
      }).catch(() => {});

    return () => clearInterval(timer);
  }, []);

  const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
  const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
  const dayNum = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  const dateStr = `${dayFormat}, ${dayNum}.${monthFormat} ${year}`;
  const timeStr = `${hours}:${minutes}`;

  return (
    <View style={[styles.container, { backgroundColor: 'rgba(0,0,0,0.5)', borderColor: 'rgba(255,255,255,0.1)' }]}>
      <View style={styles.topRow}>
        <View>
          <Text style={[styles.location, { color: colors.text }]}>{location}</Text>
          <Text style={[styles.date, { color: colors.mutedForeground }]}>{dateStr}</Text>
        </View>
        <Ionicons name="moon" size={16} color="#60A5FA" style={{ marginLeft: 20 }} />
      </View>
      <View style={styles.bottomRow}>
        <Text style={[styles.time, { color: colors.text }]}>{timeStr}</Text>
        <Text style={[styles.temp, { color: colors.text }]}>{temp}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 260,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  location: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  date: {
    fontSize: 12,
  },
  time: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  temp: {
    fontSize: 14,
    fontWeight: '600',
  }
});
