import {
  SegmentedControl,
  SegmentedControlButton,
  SegmentedControlList,
} from '@cognite/aura/components/segmented-control';

import { isTrendRangeId, TREND_RANGES } from './types';
import type { TrendRangeId } from './types';

type TrendRangeControlProps = {
  range: TrendRangeId;
  onSelect: (range: TrendRangeId) => void;
  /** Accessible name of the control. */
  label?: string;
};

/** Shortcuts for a time frame: 1 week, 1 month, 1 year. */
export function TrendRangeControl({ range, onSelect, label = 'Time frame of the trend' }: TrendRangeControlProps) {
  return (
    <SegmentedControl
      value={range}
      onValueChange={(value) => {
        if (isTrendRangeId(value)) onSelect(value);
      }}
    >
      <SegmentedControlList size="small" aria-label={label}>
        {TREND_RANGES.map((option) => (
          <SegmentedControlButton key={option.id} value={option.id} title={`Last ${option.period}`}>
            {option.label}
          </SegmentedControlButton>
        ))}
      </SegmentedControlList>
    </SegmentedControl>
  );
}
