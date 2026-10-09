import { Badge } from '@cognite/aura/components/badge';

import { formatPercent } from './oeeFormat';
import { siteMapLevel } from './oeeKpi';

type SiteOeeValueProps = {
  ratio: number | null;
};

/**
 * The OEE of a whole site, with the colour code of the map: red below 80%, orange from 80% to
 * below 90%, green from 90%. The level is also given in text for assistive technology.
 */
export function SiteOeeValue({ ratio }: SiteOeeValueProps) {
  const text = formatPercent(ratio);
  const level = siteMapLevel(ratio);

  if (level === 'critical') {
    return (
      <Badge variant="error" title="Below 80%">
        {text}
        <span className="sr-only"> (below 80%)</span>
      </Badge>
    );
  }
  if (level === 'warning') {
    return (
      <Badge variant="warning" title="80% to 90%">
        {text}
        <span className="sr-only"> (80% to 90%)</span>
      </Badge>
    );
  }
  if (level === 'good') {
    return (
      <Badge variant="success" title="90% and above">
        {text}
        <span className="sr-only"> (90% and above)</span>
      </Badge>
    );
  }
  return <span>{text}</span>;
}
