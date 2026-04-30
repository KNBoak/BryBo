import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';
import type { CalendarCell as CalendarCellData } from './hooks/useCalendar';

interface Props {
  cell: CalendarCellData;
  onPress: (date: string) => void;
}

export function CalendarCell({ cell, onPress }: Props) {
  const { date, dayOfMonth, isCurrentMonth, isToday, eventCount } = cell;

  return (
    <Pressable
      style={[
        styles.cell,
        isToday && styles.cellToday,
        !isCurrentMonth && styles.cellOtherMonth,
      ]}
      onPress={() => onPress(date)}
    >
      <Text
        style={[
          styles.dayNum,
          isToday && styles.dayNumToday,
          !isCurrentMonth && styles.dayNumOtherMonth,
        ]}
      >
        {dayOfMonth}
      </Text>
      {eventCount > 0 && (
        <View style={styles.dot} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radius.md,
  },
  cellToday: {
    borderWidth: 1.5,
    borderColor: colors.calendar.todayCellBorder,
    backgroundColor: colors.status.todayBg,
  },
  cellOtherMonth: {
    opacity: 0.35,
  },
  dayNum: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.text.primary,
  },
  dayNumToday: {
    color: colors.status.todayText,
    fontWeight: typography.weight.bold,
  },
  dayNumOtherMonth: {
    color: colors.calendar.outOfMonthText,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: colors.calendar.dotColor,
  },
});
