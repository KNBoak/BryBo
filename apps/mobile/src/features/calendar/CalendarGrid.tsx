import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import { CalendarCell } from './CalendarCell';
import type { CalendarCell as CalendarCellData } from './hooks/useCalendar';

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  cells: CalendarCellData[];
  onDayPress: (date: string) => void;
}

export function CalendarGrid({ cells, onDayPress }: Props) {
  const rows: CalendarCellData[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  return (
    <View style={styles.container}>
      {/* Day of week headers */}
      <View style={styles.dowRow}>
        {DOW_LABELS.map((d) => (
          <View key={d} style={styles.dowCell}>
            <Text style={styles.dowLabel}>{d}</Text>
          </View>
        ))}
      </View>
      {/* Day cells */}
      {rows.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((cell) => (
            <CalendarCell key={cell.date} cell={cell} onPress={onDayPress} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing[3] },
  dowRow: { flexDirection: 'row', marginBottom: spacing[1] },
  dowCell: { flex: 1, alignItems: 'center', paddingVertical: spacing[1] },
  dowLabel: { fontSize: typography.size.xs, color: colors.calendar.headerText, fontWeight: typography.weight.semibold },
  row: { flexDirection: 'row', marginBottom: 2 },
});
