import React from 'react';
import { today } from '@brybo/shared';
import { DayDetailScreen } from './DayDetailScreen';
import { AiSummaryStub } from './AiSummaryStub';

export function MyDayScreen() {
  return (
    <DayDetailScreen
      date={today()}
      showAiStub={<AiSummaryStub />}
    />
  );
}
