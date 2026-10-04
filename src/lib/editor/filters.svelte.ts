import type { BeanFilter } from './beans';
import { emptyBrewFilter, type BrewFilter } from './brews';

export interface GearFilter {
  query: string;
  showArchived: boolean;
}

export type BeanFilters = Required<BeanFilter>;

/**
 * The search and filters of every list in an open backup. Only the open tab's list is mounted, so they live here
 * and survive moving between sections.
 */
export function createFilters() {
  const filters = $state({
    beans: {
      query: '',
      showArchived: false,
      showFrozen: false,
      from: '',
      to: '',
      roastFrom: '',
      roastTo: '',
    } as BeanFilters,
    brews: emptyBrewFilter() as BrewFilter,
    mills: { query: '', showArchived: false } as GearFilter,
    methods: { query: '', showArchived: false } as GearFilter,
  });
  return filters;
}

export type Filters = ReturnType<typeof createFilters>;
