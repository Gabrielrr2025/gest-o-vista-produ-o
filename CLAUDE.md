# CLAUDE.md - AI Assistant Guide

## Project Overview

Production management application ("Gestao Vista Producao") built on the Base44 platform. It tracks weekly production planning, sales, losses, and product assertivity across multiple food-production sectors (Padaria, Confeitaria, Salgados, Minimercado, Restaurante, Frios). The app is written in Brazilian Portuguese.

## Tech Stack

- **Framework**: React 18 with Vite 6
- **Language**: JavaScript (JSX) with optional TypeScript type-checking
- **Styling**: Tailwind CSS 3 + shadcn/ui (New York style) + Radix UI primitives + custom futuristic CSS design system
- **Routing**: React Router DOM 6 (convention-based from `src/pages/`)
- **State**: Local component state (`useState`), TanStack React Query 5 (server state), React Hook Form + Zod (forms)
- **Charts**: Recharts
- **Backend**: Base44 SDK (`@base44/sdk`) - serverless functions in `functions/` directory (run on Deno)
- **Database**: Neon PostgreSQL (serverless) - accessed via `POSTGRES_CONNECTION_URL` env var
- **Icons**: Lucide React
- **Drag & Drop**: `@hello-pangea/dnd`
- **Utilities**: `lodash`
- **3D**: `three`
- **Payments**: `@stripe/react-stripe-js`, `@stripe/stripe-js`
- **Rich Text**: `react-quill`
- **Maps**: `react-leaflet`

## Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run lint         # ESLint (quiet mode)
npm run lint:fix     # ESLint with auto-fix
npm run typecheck    # TypeScript type-checking via jsconfig.json
npm run preview      # Preview production build
```

There is no test framework configured in this project.

## Project Structure

```
src/
  api/
    base44Client.js          # Base44 SDK client initialization (requiresAuth: false)
  components/
    admin/
      UserFormDialog.jsx     # Create/edit user form with permissions
    calendar/
      CalendarEventDialog.jsx
      CalendarManager.jsx
    common/                  # Shared futuristic UI primitives
      ButtonFuturistic.jsx
      DateRangePicker.jsx
      InputFuturistic.jsx
      KPICard.jsx
      ModalFuturistic.jsx
      SectorBadge.jsx
      SectorFilter.jsx
    dashboard/               # Dashboard charts and widgets (14 components)
      AssertivityBySectorChart.jsx
      AssertivityChart.jsx
      AssertivityVsSalesChart.jsx
      LossAnalysis.jsx
      MiniSparkline.jsx
      ProductTrendChart.jsx
      SalesChart.jsx
      SalesVsLossChart.jsx
      SectorChart.jsx
      TopProductsBySector.jsx
      TopProductsTable.jsx
      TopSellingProducts.jsx
      WeekAlerts.jsx
      WeekNavigator.jsx      # Also exports getWeekBounds() helper
    import/                  # Data import components
      AutoSQLSync.jsx
      PDFImporter.jsx
      ProductMapper.jsx
      SQLDataProvider.jsx
      SQLImporter.jsx
    production/
      ProductionSuggestion.jsx
    products/
      Productsmanager.jsx
      UnmappedProductsSuggestion.jsx
    reports/                 # Reporting and analytics (16 components)
      DateRangePicker.jsx
      GeneralEvolutionChart.jsx
      LineChart.jsx
      MultiPeriodComparison.jsx
      PieChartReport.jsx
      ProductComparisonChart.jsx
      ProductComparisonModal.jsx
      ProductSelector.jsx
      Productcomparisontable.jsx
      Productevolution.jsx
      Productranking.jsx
      ProductsPieChart.jsx
      SalesComparison.jsx
      SectorDistributionChart.jsx
      SectorEvolutionChart.jsx
      Sectorcards.jsx
    settings/
      DataReset.jsx
      DatabaseDiagnostic.jsx
      ProductionRationalSettings.jsx
    ui/                      # shadcn/ui components (DO NOT EDIT manually)
  hooks/
    use-mobile.jsx           # Mobile viewport detection
  lib/
    AuthContext.jsx          # Authentication context (not used by Layout - kept for reference)
    NavigationTracker.jsx    # Page navigation tracking
    PageNotFound.jsx         # 404 component
    app-params.js            # Environment and URL parameter handling
    query-client.js          # React Query client singleton
    utils.js                 # cn() class merge utility, isIframe check
  pages/                     # Top-level route pages (auto-registered)
    Admin.jsx                # User management and permissions (admin-only, self-guards with redirect)
    Calendar.jsx             # Event calendar
    Dashboard.jsx            # Main dashboard with KPIs and charts (~254 lines)
    Planning.jsx             # Weekly production planning (~1166 lines, largest page)
    Production.jsx           # Production tracking (~57 lines)
    Products.jsx             # Product CRUD and mapping (~145 lines)
    Reports.jsx              # Multi-period reports and data export (~1151 lines)
    Settings.jsx             # App configuration and diagnostics
    UserNotRegisteredError.jsx  # Shown when user email not registered
  utils/
    index.ts                 # createPageUrl() for navigation
  App.jsx                    # Root component (providers + router)
  Layout.jsx                 # Sidebar navigation layout with permission checks
  pages.config.js            # AUTO-GENERATED page routing config (only edit mainPage)
  globals.css                # Global styles + futuristic design system CSS classes
  index.css                  # Tailwind directives
  main.jsx                   # Entry point

functions/                   # Backend serverless functions (TypeScript, Deno runtime)
  Createproduct.ts
  Debugplanning.ts
  Deleteproduct.ts
  Getlossesreport.ts
  Getplanningdata.ts
  Getproductcomparison.ts
  Getproductevolution.ts
  Getproducts.ts
  Updateproduct.ts
  diagnosticDB.ts
  fetchSQLData.ts
  getConfig.ts
  getCurrentWeek.ts
  getDashboardData.ts        # Despite name, contains report query logic
  getPlanning.ts
  getProductEvolution.ts
  getProductMovementData.ts
  getReportData.ts
  getReportData_MULTIPERIOD.ts
  getSalesReport.ts
  saveConfig.ts
  savePlanning.ts
  testConnection.ts
  # Total: 23 backend functions
```

## Architecture

### Routing

Pages in `src/pages/` are auto-registered in `pages.config.js`. Routes map to `/{PageName}` (PascalCase). The main page is `Dashboard` (renders at `/`). **Do not manually edit `pages.config.js`** except for the `mainPage` value.

### Authentication & Authorization

- Auth is handled directly via `base44.auth.me()` - called imperatively in component effects
- **No AuthContext is used by the Layout** - `Layout.jsx` calls `base44.auth.me()` directly and stores the result in local state
- Role-based: `admin` vs regular user
- Granular permissions per feature stored in `user.permissions`: `products`, `planning`, `calendar`, `reports`, `settings`, `admin`
- Default permissions for non-admins: products ✓, planning ✓, calendar ✓, reports (from `user.reports_access`), settings ✗, admin ✗
- Permission checks gate sidebar navigation items in `Layout.jsx`
- `Admin.jsx` self-guards: redirects to `/` if user is not `admin` role
- Sidebar state (minimized/expanded) is persisted to `localStorage`

### Data Fetching

All server data is fetched through the Base44 SDK:

```jsx
// Backend function invocation
const { data } = useQuery({
  queryKey: ['dashboardData', dateRange.from, dateRange.to, sector],
  queryFn: async () => {
    const response = await base44.functions.invoke('getDashboardData', {
      startDate, endDate, sector
    });
    return response.data;
  }
});

// Entity CRUD (Base44 entities)
const users = await base44.entities.User.list();
const products = await base44.entities.Product.list();
const records = await base44.entities.ProductionRecord.list();
await base44.entities.User.update(id, { active: false });
```

React Query is configured with: 1 retry on failure, no refetch on window focus.

### Backend Functions

TypeScript files in `functions/` directory. **Runtime is Deno** (not Node.js). Each file exports a handler invoked via `Deno.serve()`. Imports use `npm:` prefix (e.g., `npm:@base44/sdk@0.8.6`, `npm:@neondatabase/serverless@0.9.0`).

Authentication pattern in every function:
```typescript
const base44 = createClientFromRequest(req);
const user = await base44.auth.me();
if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
```

Database access pattern:
```typescript
const connectionString = Deno.env.get('POSTGRES_CONNECTION_URL');
const sql = neon(connectionString);
const result = await sql`SELECT ... FROM ...`;
```

Key functions:
- `getDashboardData` - Contains report query logic (sales/losses/performance) despite name
- `getPlanning` / `savePlanning` - Weekly planning CRUD (upsert by produto_id + data)
- `getReportData` / `getReportData_MULTIPERIOD` - Reporting with comparison periods
- `Createproduct` / `Updateproduct` / `Deleteproduct` / `Getproducts` - Product CRUD
- `fetchSQLData` / `testConnection` - External SQL data integration
- `diagnosticDB` - Database diagnostics
- `getConfig` / `saveConfig` - App configuration storage

### Database Schema (Neon PostgreSQL)

Key tables inferred from SQL queries in functions:
- `produtos` - Products (`id`, `nome`, `setor`, `unidade`)
- `vendas` - Sales records (`produto_id`, `data`, `quantidade`, `valor_reais`)
- `perdas` - Loss records (`produto_id`, `data`, `quantidade`, `valor_reais`)
- `planejamento` - Planning (`produto_id`, `data`, `quantidade_planejada`, `updated_at`)

## Futuristic Design System

The app uses a custom "futuristic/cyberpunk" visual theme defined in `globals.css`. **Use these custom classes instead of plain Tailwind where applicable:**

### CSS Custom Properties (HSL)
```css
--bg-void, --bg-dark, --bg-surface, --bg-elevated   /* Backgrounds */
--text-primary, --text-secondary, --text-tertiary    /* Text */
--accent-neon  (180 100% 50% = cyan)                 /* Primary accent */
--accent-purple (280 90% 60%)                        /* Secondary accent */
--success-neon, --warning-neon, --error-neon         /* Status colors */
--border-subtle, --border-medium, --border-bright    /* Borders */
```

### Utility Classes
- **Cards**: `.card-futuristic` (dark surface + neon top-border on hover), `.card-glass` (glassmorphism)
- **Glass effects**: `.glass`, `.glass-strong` (backdrop-filter blur)
- **Buttons**: `.btn-futuristic` (neon cyan CTA), `.btn-secondary-futuristic`, `.btn-ghost-futuristic`
- **Badges**: `.badge-futuristic`, `.badge-cyan`, `.badge-purple`, `.badge-success`, `.badge-warning`, `.badge-error`
- **Glow**: `.glow-cyan`, `.glow-purple`, `.pulse-glow`
- **Text**: `.text-gradient` (cyan-to-purple gradient), `.neon-text`
- **Animations**: `.fade-in`, `.slide-in-up`
- **Layout**: `.gradient-bg` (animated background), `.cyber-grid` (subtle grid overlay)
- **Tables**: `.table-futuristic`
- **Inputs**: `.input-futuristic`
- **Modals**: `.modal-futuristic`, `.modal-header-futuristic`, `.modal-body-futuristic`, `.modal-footer-futuristic`
- **Skeleton**: `.skeleton` (shimmer loading state)
- **Print**: `.no-print` (hidden in print mode), `#planning-print-area` (print target)

## Key Conventions

### File & Naming

- **Pages**: PascalCase filenames (`Dashboard.jsx`, `Planning.jsx`)
- **Components**: PascalCase filenames, organized by feature folder
- **Functions (backend)**: Mixed case - some camelCase (`getDashboardData`), some PascalCase (`Createproduct`) - maintain existing patterns
- **Hooks**: `use-` prefix with kebab-case filenames
- **Path alias**: `@/` maps to `src/` (configured in jsconfig.json)

### Component Patterns

- Functional components with hooks only (no class components)
- Props destructuring in function signature
- `useMemo` / `useCallback` for performance-critical computations
- Framer Motion `motion.*` for animations
- Toast notifications via `sonner` (`toast()`) and `react-hot-toast`
- `localStorage` used for UI persistence (sidebar state, filter selections, form state between sessions)

### Planning Page Specifics (`Planning.jsx`)

The Planning page is the most complex (~1166 lines). Key behaviors:
- Defaults to **next week** (future planning), not current week
- Lock/unlock mechanism: past/current weeks are locked; an unlock code dialog is shown to edit them
- `localStorage` persists: selected sector, search term, and planned quantities per week
- Debounced auto-save on quantity changes
- Exports to Excel (XLSX) and PDF (jsPDF)
- Print target: `id="planning-print-area"` used by print CSS

### Styling

- Tailwind CSS utility classes for all styling
- `cn()` helper from `@/lib/utils` for conditional class merging
- CSS variables (HSL) for theming - defined in `globals.css`
- Custom futuristic CSS classes from `globals.css` are used extensively (see Design System section)
- Responsive design: `sm:`, `md:`, `lg:` breakpoints; mobile header + sidebar overlay pattern
- Sidebar collapses to icon-only mode (`w-20`) when minimized, tooltips shown via Radix Tooltip

### Date Handling

- **Weeks start on Tuesday** (`weekStartsOn: 2`) - this is a domain-specific business rule, not configurable
- `date-fns` for date calculations and formatting (preferred)
- Brazilian Portuguese locale (`ptBR`) for date display
- `moment` also present (legacy usage, avoid adding new usages)
- `getWeekBounds(date)` is a local helper defined in both `Planning.jsx` and `WeekNavigator.jsx`

### Data Export

- Excel via `xlsx` library (`import * as XLSX from 'xlsx'`)
- PDF via `jsPDF` (`import jsPDF from 'jspdf'`) + `html2canvas` for DOM capture
- Export buttons available in Planning and Reports pages

### Sectors

The six production sectors used throughout the app:
- `Padaria`, `Confeitaria`, `Salgados`, `Minimercado`, `Restaurante`, `Frios`
- Sector filter uses value `"all"` for no filter

## Linting & Type-Checking Scope

### ESLint applies to:
- `src/components/**/*.{js,jsx}` (excluding `src/components/ui/**`)
- `src/pages/**/*.{js,jsx}`
- `src/Layout.jsx`

### ESLint ignores:
- `src/lib/**/*`
- `src/components/ui/**/*` (shadcn/ui generated components)

### Key ESLint rules:
- `unused-imports/no-unused-imports`: **error** - no unused imports allowed
- `unused-imports/no-unused-vars`: **warn** (vars prefixed with `_` are exempt)
- `react-hooks/rules-of-hooks`: **error**
- `react/no-unknown-property`: **error** (with exceptions for `cmdk-input-wrapper`, `toast-close`)
- `react/prop-types`: off (no PropTypes enforcement)
- `react/react-in-jsx-scope`: off (React 18 auto-import)

### TypeScript checking applies to:
- `src/components/**/*.js`
- `src/pages/**/*.jsx`
- `src/Layout.jsx`
- Excludes: `node_modules`, `dist`, `src/components/ui`, `src/api`, `src/lib`

## Environment Variables

- `VITE_BASE44_APP_ID` - Base44 application ID
- `VITE_BASE44_APP_BASE_URL` - Base44 API base URL
- `BASE44_LEGACY_SDK_IMPORTS` - Enable legacy SDK import paths (set to `'true'` if needed)
- `POSTGRES_CONNECTION_URL` - Neon PostgreSQL connection string (backend functions only, via `Deno.env.get()`)

## Vite Plugin Configuration

The `@base44/vite-plugin` is configured with:
- `legacySDKImports`: controlled by `BASE44_LEGACY_SDK_IMPORTS` env var
- `hmrNotifier`: `true` - HMR change notifications
- `navigationNotifier`: `true` - navigation event notifications
- `visualEditAgent`: `true` - visual editing agent support

## Things to Watch Out For

1. **`pages.config.js` is auto-generated** - Only change the `mainPage` value. New pages are registered automatically when created in `src/pages/`.
2. **`src/components/ui/` is generated by shadcn/ui** - Do not manually edit these files. Use `npx shadcn-ui@latest add <component>` to add new ones.
3. **No test suite exists** - There are no automated tests. Verify changes manually or by running `npm run build` and `npm run lint`.
4. **Backend functions run on Deno**, not Node.js - use `npm:` import prefix, `Deno.env.get()` for env vars, `Deno.serve()` for the handler.
5. **Week start day is Tuesday** - Not Monday or Sunday. This is a core business rule throughout the planning and dashboard logic. Always pass `{ weekStartsOn: 2 }` to `date-fns` week functions.
6. **Brazilian Portuguese** - All user-facing text, labels, and date formatting use Portuguese (Brazil). Use `ptBR` locale from `date-fns/locale`.
7. **Layout auth is not from AuthContext** - `Layout.jsx` calls `base44.auth.me()` directly; `AuthContext.jsx` exists in `src/lib/` but is not imported by Layout. Don't add AuthContext to Layout.
8. **`getDashboardData.ts` naming** - This function actually implements report querying logic (sales/losses/performance by date range), not a dashboard aggregation. The name is misleading; do not rename without checking all callers.
9. **`getWeekBounds` is duplicated** - Defined locally in both `Planning.jsx` and exported from `WeekNavigator.jsx`. Use the imported version from `WeekNavigator` in new code outside Planning.
10. **Planning page defaults to next week** - The initial state for `currentDate` advances one week forward so users are always planning the future week.
11. **Print layout** - Planning page has `id="planning-print-area"` which is the print target per the CSS print styles. The `.no-print` class hides elements from print output.
