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
  FormField,
  FormFieldGrid,
  Badge,
  InfoButton,
  StatCard,
  TablePagination,
  DataTable,
  FullScreenWorkspace,
  ProgressBar,
  Switch,
  Accordion,
} from './primitives';

// ── New unified components (Phase 1) ──
export { default as EmptyState } from './EmptyState';
export { default as SearchInput } from './SearchInput';
export { default as IconButton } from './IconButton';
export { default as SectionCard } from './SectionCard';
export { default as AddMembers } from './AddMembers';
export { default as RoleOptionBoxes } from './RoleOptionBoxes';
export { default as PageLoadGuard } from './PageLoadGuard';
export { DataLoading } from './DataLoading';
export { Spinner, LoadingState } from './Spinner';
export { default as TimeframeFilter } from './TimeframeFilter';
// ── Dropdowns (Phase 2: consolidate into Select) ──
export { default as NexusDropdown } from './NexusDropdown';

// ── Page chrome (UDIF 2.1) ──
export { default as PageHeader } from './PageHeader';
export { default as PageToolbar } from './PageToolbar';
export { default as ListPageLayout } from './ListPageLayout';
export { default as DataOverviewSection } from './DataOverviewSection';
export { default as DataMiniChart } from './DataMiniChart';
export { default as DashboardWidgetShell } from './DashboardWidgetShell';
export { default as DataListRow } from './DataListRow';
export { default as ChartSurface, CHART_MUTED } from './ChartSurface';
export { default as DeltaBadge } from './DeltaBadge';
export { default as MobileFilterSheet } from './MobileFilterSheet';
export { default as MobileFilterField } from './MobileFilterField';
export { default as MobilePageHeader } from './MobilePageHeader';
export { default as ListCard } from './ListCard';
export { default as FilterChips, FilterChip } from './FilterChips';
export { default as CountBadge } from './CountBadge';
export { default as MobileCollapsibleSection } from './MobileCollapsibleSection';
export { default as DesktopRecommendedBanner } from './DesktopRecommendedBanner';
export { UserAvatar, UserLabel } from './UserAvatar';
export { default as DashboardSkeleton } from './DashboardSkeleton';
export { default as PageSkeleton } from './PageSkeleton';

// ── Modals ──
export { NexusModal, NexusModal as Modal, MODAL_SIZES } from './NexusModal';
export {
  ModalShell,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalOverlay,
  MODAL_WIDTH_PX,
  MODAL_PANEL_CLASS,
  MODAL_OVERLAY_CLASS,
  getModalPanelStyle,
  getModalPanelClassName,
} from './ModalShell';
/** @deprecated Use ModalShell — see docs/COMPONENT_STANDARDS.md */
export { CenteredModal } from './CenteredModal';
export { VisualExplainerModal } from './VisualExplainerModal';
