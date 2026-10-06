import { IconChartLine } from '@tabler/icons-react';

type SelectableNameProps = {
  name: string;
  isSelected: boolean;
};

/** A name on one line in a table cell; the selected row is marked. */
export function SelectableName({ name, isSelected }: SelectableNameProps) {
  if (!isSelected) {
    return (
      <span className="block min-w-0 flex-1 truncate" title={name}>
        {name}
      </span>
    );
  }
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2" title={name}>
      <IconChartLine aria-hidden className="size-4 shrink-0" />
      <span className="truncate font-medium">{name}</span>
      <span className="sr-only">(selected)</span>
    </span>
  );
}
