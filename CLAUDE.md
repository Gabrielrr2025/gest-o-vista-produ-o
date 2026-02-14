# CLAUDE.md - AI Assistant Guide

## Project Overview

Production management application ("Gestao Vista Producao") built on the Base44 platform. It tracks weekly production planning, sales, losses, and product assertivity across multiple food-production sectors (Padaria, Confeitaria, Salgados, Minimercado, Restaurante, Frios). The app is written in Brazilian Portuguese.

## Tech Stack

- **Framework**: React 18 with Vite 6
- **Language**: JavaScript (JSX) with optional TypeScript type-checking
- **Styling**: Tailwind CSS 3 + shadcn/ui (New York style) + Radix UI primitives
- **Routing**: React Router DOM 6 (convention-based from `src/pages/`)
- **State**: React Context (auth), TanStack React Query 5 (server state), React Hook Form + Zod (forms)
- **Charts**: Recharts
- **Backend**: Base44 SDK (`@base44/sdk`) - serverless functions in `functions/` directory
- **Database**: Neon PostgreSQL (serverless)
- **Icons**: Lucide React

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
  api/base44Client.js       # Base44 SDK client initialization
  components/
    admin/                   # Admin panel components
    calendar/                # Calendar event management
    common/                  # Shared components (KPICard, SectorFilter, SectorBadge, DateRangePicker)
    dashboard/               # Dashboard charts and widgets (14 components)
    import/                  # Data import (SQL, PDF, product mapping)
    production/              # Production suggestion component
    products/                # Product management
    reports/                 # Reporting and analytics (16 components)
    settings/                # Settings and diagnostics
    ui/                      # shadcn/ui components (DO NOT EDIT manually)
  hooks/
    use-mobile.jsx           # Mobile viewport detection
  lib/
    AuthContext.jsx           # Authentication context provider & useAuth hook
    NavigationTracker.jsx     # Page navigation tracking
    PageNotFound.jsx          # 404 component
    app-params.js            # Environment and URL parameter handling
    query-client.js          # React Query client singleton
    utils.js                 # cn() class merge utility, isIframe check
  pages/                     # Top-level route pages (auto-registered)
    Admin.jsx                # User management and permissions
    Calendar.jsx             # Event calendar
    Dashboard.jsx            # Main dashboard with KPIs and charts
    Planning.jsx             # Weekly production planning (largest page ~892 lines)
    Production.jsx           # Production tracking
    Products.jsx             # Product CRUD and mapping
    Reports.jsx              # Multi-period reports and data export
    Settings.jsx             # App configuration and diagnostics
  utils/
    index.ts                 # createPageUrl() for navigation
  App.jsx                    # Root component (providers + router)
  Layout.jsx                 # Sidebar navigation layout with permission checks
  pages.config.js            # AUTO-GENERATED page routing config (only edit mainPage)
  globals.css                # Global styles
  index.css                  # Tailwind directives
  main.jsx                   # Entry point

functions/                   # Backend serverless functions (TypeScript)
  *.ts                       # 21 backend functions (CRUD, reports, planning, diagnostics)
```

## Architecture

### Routing

Pages in `src/pages/` are auto-registered in `pages.config.js`. Routes map to `/{PageName}` (PascalCase). The main page is `Dashboard` (renders at `/`). **Do not manually edit `pages.config.js`** except for the `mainPage` value.

### Authentication & Authorization

- `AuthProvider` wraps the app and exposes `useAuth()` hook
- Auth flow: check public settings -> validate token -> load user
- Role-based permissions: `admin` vs regular user
- Granular permissions per feature: `products`, `planning`, `calendar`, `reports`, `settings`, `admin`
- Permission checks gate sidebar navigation items and component rendering in `Layout.jsx`

### Data Fetching

All server data is fetched through the Base44 SDK:

```jsx
// Backend function invocation
const { data } = useQuery({
  queryKey: ['dashboardData', weekStart],
  queryFn: () => base44.functions.invoke('getDashboardData', { weekStart })
});

// Entity CRUD
const products = await base44.entities.Product.list();
await base44.entities.Product.create({ name, sector });
```

React Query is configured with: 1 retry on failure, no refetch on window focus.

### Backend Functions

TypeScript files in `functions/` directory. Each file exports a handler invoked via `base44.functions.invoke('functionName', params)`. Key functions:
- `getDashboardData` - Dashboard aggregation
- `getPlanning` / `savePlanning` - Weekly planning CRUD
- `getReportData` / `getReportData_MULTIPERIOD` - Reporting
- `Createproduct` / `Updateproduct` / `deleteproduct` / `Getproducts` - Product CRUD
- `fetchSQLData` / `testConnection` - External SQL data integration
- `diagnosticDB` - Database diagnostics

## Key Conventions

### File & Naming

- **Pages**: PascalCase filenames (`Dashboard.jsx`, `Planning.jsx`)
- **Components**: PascalCase filenames, organized by feature folder
- **Functions (backend)**: Mixed case - some camelCase, some PascalCase (maintain existing patterns)
- **Hooks**: `use-` prefix with kebab-case filenames
- **Path alias**: `@/` maps to `src/` (configured in jsconfig.json)

### Component Patterns

- Functional components with hooks only (no class components)
- Props destructuring in function signature
- `useMemo` / `useCallback` for performance-critical computations
- Framer Motion `motion.*` for animations
- Toast notifications via `sonner` and `react-hot-toast`

### Styling

- Tailwind CSS utility classes for all styling
- `cn()` helper from `@/lib/utils` for conditional class merging
- CSS variables (HSL) for theming - defined in `globals.css`
- Responsive design: `sm:`, `md:`, `lg:` breakpoints
- Dark mode supported via `class` strategy

### Date Handling

- **Weeks start on Tuesday** (`weekStartsOn: 2`) - this is a domain-specific business rule
- `date-fns` for date calculations and formatting
- Brazilian Portuguese locale (`ptBR`) for date display
- `moment` also present (legacy usage)

### Data Export

- Excel via `xlsx` library
- PDF via `jsPDF` + `html2canvas`
- Export buttons available in Planning and Reports pages

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
- `react-hooks/rules-of-hooks`: **error**
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

## Things to Watch Out For

1. **`pages.config.js` is auto-generated** - Only change the `mainPage` value. New pages are registered automatically when created in `src/pages/`.
2. **`src/components/ui/` is generated by shadcn/ui** - Do not manually edit these files. Use `npx shadcn-ui@latest add <component>` to add new ones.
3. **No test suite exists** - There are no automated tests. Verify changes manually or by running `npm run build` and `npm run lint`.
4. **Backend functions are TypeScript** while frontend is JSX - they live in separate directories with different conventions.
5. **Week start day is Tuesday** - Not Monday or Sunday. This is a core business rule throughout the planning and dashboard logic.
6. **Brazilian Portuguese** - All user-facing text, labels, and date formatting use Portuguese (Brazil).
