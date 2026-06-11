/**
 * Coreknot UI — global component library barrel export.
 *
 * Primary design system: primitives (CSS var tokens from index.css).
 * Shadcn/Radix components exported separately for gradual migration.
 */

// ── Primitives (buttons, inputs, cards, tables, layout) ──
export {
  Skeleton,
  Button,
  Card,
  PageContainer,
  TabSwitcher,
  Input,
  FormFieldGrid,
  Badge,
  InfoButton,
  StatCard,
  TablePagination,
  DataTable,
  DEFAULT_TABLE_PAGE_SIZE,
  ProgressBar,
  Switch,
  Accordion,
} from './primitives';

export { FullScreenWorkspace } from './FullScreenWorkspace';

// ── New unified components (Phase 1) ──
export { default as EmptyState } from './EmptyState';
export { default as SearchInput } from './SearchInput';
export { default as IconButton } from './IconButton';
export { default as SectionCard } from './SectionCard';
export { default as AddMembers } from './AddMembers';
export { default as PageLoadGuard } from './PageLoadGuard';
export { DataLoading } from './DataLoading';
export { Spinner, LoadingState } from './Spinner';
export { LoadingPhrase } from './LoadingPhrase';
export { default as TimeframeFilter } from './TimeframeFilter';
// ── Dropdowns (Phase 2: consolidate into Select) ──
export { default as NexusDropdown } from './NexusDropdown';

// ── Page chrome (UDIF 2.1) ──
export { default as PageHeader } from './PageHeader';
export { default as PageToolbar } from './PageToolbar';
export { default as ListPageLayout } from './ListPageLayout';
export { default as DataOverviewSection } from './DataOverviewSection';
export { default as DashboardWidgetShell } from './DashboardWidgetShell';
export { default as DataListRow } from './DataListRow';
export { default as DeltaBadge } from './DeltaBadge';
export { default as MetricCard } from './MetricCard';
export { default as ListCard } from './ListCard';
export { default as CountBadge } from './CountBadge';
export { default as MobileCollapsibleSection } from './MobileCollapsibleSection';
export { default as DesktopRecommendedBanner } from './DesktopRecommendedBanner';
export { UserAvatar, UserLabel } from './UserAvatar';
export { default as PageSkeleton } from './PageSkeleton';
export { default as QueryErrorBanner, getQueryErrorMessage } from './QueryErrorBanner';

// Heavy chart/modal exports live in ./charts.jsx and ./modals.jsx to keep the main barrel lean.
