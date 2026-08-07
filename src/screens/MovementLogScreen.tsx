import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, SectionList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS } from '../utils/constants';
import { getEvents } from '../services/movementLogService';
import { formatTime, formatRelativeDate } from '../utils/formatters';
import { MotionEvent } from '../types';

export const MovementLogScreen = () => {
  const navigation = useNavigation();
  const [filter, setFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [sections, setSections] = useState<{title: string, data: MotionEvent[]}[]>([]);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const events = await getEvents();
      
      let filtered = events;
      if (filter === 'Person') filtered = events.filter((e: any) => e.type === 'person');
      if (filter === 'Today') {
        const today = new Date().toDateString();
        filtered = events.filter((e: any) => new Date(e.timestamp).toDateString() === today);
      }
      
      // Group by date
      const grouped = filtered.reduce((acc: any, event: any) => {
        const dateStr = formatRelativeDate(event.timestamp);
        if (!acc[dateStr]) acc[dateStr] = [];
        acc[dateStr].push(event);
        return acc;
      }, {});

      const sortedSections = Object.keys(grouped).map(key => ({
        title: key,
        data: grouped[key].sort((a: any, b: any) => b.timestamp - a.timestamp)
      }));

      setSections(sortedSections);
    } catch (e) {
      console.warn('Failed to load events', e);
    }
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, [filter]);

  const renderFilter = (label: string) => (
    <Pressable 
      style={[styles.filterPill, filter === label && styles.filterPillActive]}
      onPress={() => setFilter(label)}
    >
      <Text style={[styles.filterText, filter === label && styles.filterTextActive]}>{label}</Text>
    </Pressable>
  );

  const renderItem = ({ item }: { item: MotionEvent }) => {
    const isPerson = item.type === 'person';
    return (
      <Pressable style={[styles.eventCard, { borderLeftColor: isPerson ? COLORS.PRIMARY : COLORS.WARNING }]}>
        <View style={styles.eventHeader}>
          <Text style={styles.eventIcon}>{isPerson ? '🚶' : '⚡'}</Text>
          <View style={styles.eventInfo}>
            <Text style={styles.eventTitle}>{isPerson ? 'Person detected' : 'Motion detected'}</Text>
            <Text style={styles.eventTime}>{formatTime(item.timestamp)}</Text>
          </View>
        </View>
        <View style={styles.tagsRow}>
          {item.hasPhoto && <Text style={styles.tag}>📷 Photo</Text>}
          {item.hasVideo && <Text style={styles.tag}>🎥 Video</Text>}
          {item.uploaded && <Text style={styles.tag}>☁️ Uploaded</Text>}
          {!item.hasPhoto && !item.hasVideo && <Text style={[styles.tag, styles.tagDim]}>⚠️ Log only</Text>}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Text style={styles.title}>Movement Log</Text>
        <View style={styles.headerRight}>
          <Text style={styles.icon}>🔍</Text>
        </View>
      </View>

      <View style={styles.filterBar}>
        {renderFilter('All')}
        {renderFilter('Person')}
        {renderFilter('Today')}
        {renderFilter('This Week')}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.sectionHeader}>📅 {title}</Text>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={COLORS.PRIMARY} />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🛡️</Text>
            <Text style={styles.emptyText}>No events yet</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  backBtn: {
    padding: SPACING.sm,
  },
  backIcon: {
    color: COLORS.TEXT,
    fontSize: 24,
  },
  title: {
    color: COLORS.TEXT,
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerRight: {
    padding: SPACING.sm,
  },
  icon: {
    fontSize: 20,
  },
  filterBar: {
    flexDirection: 'row',
    padding: SPACING.md,
    backgroundColor: COLORS.BACKGROUND,
  },
  filterPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.SURFACE,
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  filterPillActive: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  filterText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
  },
  filterTextActive: {
    color: '#000',
    fontWeight: 'bold',
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  sectionHeader: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  eventCard: {
    backgroundColor: COLORS.CARD,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventIcon: {
    fontSize: 24,
    marginRight: SPACING.md,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    color: COLORS.TEXT,
    fontSize: 16,
    fontWeight: 'bold',
  },
  eventTime: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    marginTop: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    flexWrap: 'wrap',
  },
  tag: {
    fontSize: 10,
    color: COLORS.TEXT,
    backgroundColor: COLORS.SURFACE,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  tagDim: {
    color: COLORS.TEXT_DIM,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 16,
  },
});
