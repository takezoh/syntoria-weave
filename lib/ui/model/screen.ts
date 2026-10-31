export type MobilePage = 'list' | 'action' | 'catalog';
export type InspectorPage = 'action' | 'catalog' | null;

export interface ScreenProjection {
  readonly mode: 'mobile' | 'wide';
  readonly page: MobilePage;
  readonly listVisible: boolean;
}

/** Select the only visible page on narrow layouts without changing editor state. */
export function projectScreen(input: {readonly mobile: boolean; readonly inspector: InspectorPage; readonly detailOpen?: boolean}): ScreenProjection {
  if (!input.mobile) return {mode: 'wide', page: input.inspector ?? 'list', listVisible: true};
  const page = input.detailOpen === false ? 'list' : input.inspector ?? 'list';
  return {mode: 'mobile', page, listVisible: page === 'list'};
}
