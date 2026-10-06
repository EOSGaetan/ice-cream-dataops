import { Badge } from '@cognite/aura/components/badge';

import { formatPercent } from './oeeFormat';
import { oeeLevel } from './oeeKpi';

type OeeValueProps = {
  ratio: number | null;
};

/** An OEE percentage; values below the thresholds stand out as a status badge. */
export function OeeValue({ ratio }: OeeValueProps) {
  const text = formatPercent(ratio);
  const level = oeeLevel(ratio);

  if (level === 'critical') {
    return (
      <Badge variant="error" title="Below the 70% alert threshold">
        {text}
      </Badge>
    );
  }
  if (level === 'warning') {
    return (
      <Badge variant="warning" title="Below 85%">
        {text}
      </Badge>
    );
  }
  return <span>{text}</span>;
}
