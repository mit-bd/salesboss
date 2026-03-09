

# MASTER BUILD PROMPT — SalesBoss CRM

Below is the complete, self-contained prompt to recreate the entire SalesBoss system from scratch in a new Lovable project using Supabase (not Lovable Cloud).

---

## MASTER PROMPT

```text
Build a complete multi-tenant SaaS CRM called "SalesBoss" optimized for tele-sales teams. 
Use React + Vite + TypeScript + Tailwind CSS + shadcn/ui for the frontend.
Use Supabase (external project) for database, auth, edge functions, realtime, and storage.
Do NOT use Lovable Cloud. Connect to an external Supabase project.

==========================================================
SECTION 1: PRODUCT OVERVIEW
==========================================================

SalesBoss is a multi-tenant B2B SaaS CRM for tele-sales operations. It manages orders, 
a 5-step followup pipeline, upsells, repeat orders, team management, commissions, and 
activity tracking. A platform Owner approves new business registrations (tenants), each 
getting an isolated project with their own admin, team, orders, products, and customers.

Brand: "SalesBoss" with a PhoneForwarded icon. Support light/dark/system theme via next-themes.

==========================================================
SECTION 2: MULTI-TENANT ARCHITECTURE
==========================================================

All data is isolated by `project_id`. Every core table (orders, customers, products, 
delivery_methods, order_sources, notifications, order_activity_logs) has a `project_id` 
column. All queries and RLS policies scope data to the user's project_id.

Helper function:
  CREATE FUNCTION get_user_project_id(_user_id uuid) RETURNS uuid
  -- Returns project_id from profiles table for the given user

==========================================================
SECTION 3: DATABASE SCHEMA
==========================================================

Tables to create (all with RLS enabled):

1. projects
   - id uuid PK default gen_random_uuid()
   - business_name text NOT NULL
   - owner_user_id uuid NOT NULL (references the admin who owns this tenant)
   - is_active boolean default true
   - followup_test_mode boolean default false
   - created_at timestamptz default now()
   - updated_at timestamptz default now()

2. profiles
   - id uuid PK default gen_random_uuid()
   - user_id uuid NOT NULL (references auth.users ON DELETE CASCADE)
   - full_name text
   - phone text
   - avatar_url text
   - project_id uuid (references projects)
   - created_at timestamptz default now()
   - updated_at timestamptz default now()

3. user_roles
   - id uuid PK default gen_random_uuid()
   - user_id uuid NOT NULL (references auth.users ON DELETE CASCADE)
   - role app_role NOT NULL (enum: admin, sub_admin, sales_executive, owner)
   - created_at timestamptz default now()
   - UNIQUE(user_id, role)

4. project_requests
   - id uuid PK
   - user_id uuid
   - business_name text NOT NULL
   - owner_name text NOT NULL
   - email text NOT NULL
   - phone text default ''
   - status text default 'pending' (pending/approved/rejected)
   - reviewed_by uuid
   - reviewed_at timestamptz
   - project_id uuid
   - created_at timestamptz default now()

5. permissions
   - id uuid PK
   - key text NOT NULL (e.g. "orders.view", "followups.view", "orders.create", 
     "orders.edit", "orders.delete", "products.view", "products.edit", 
     "delivery.view", "delivery.edit", "sales.view_performance", "commission.view",
     "commission.manage", "roles.manage", "audit.view", "backup.view", "backup.export",
     "followups.view", "followups.complete")
   - label text NOT NULL
   - category text NOT NULL (Orders, Products, Delivery, Sales, Commission, Access, System)
   - created_at timestamptz default now()

6. role_permissions
   - id uuid PK
   - role text NOT NULL
   - permission_key text NOT NULL
   - created_at timestamptz default now()

7. customers
   - id uuid PK
   - name text default ''
   - mobile_number text NOT NULL UNIQUE
   - address text default ''
   - project_id uuid
   - created_at timestamptz default now()
   - updated_at timestamptz default now()

8. products
   - id uuid PK
   - title text NOT NULL
   - sku text NOT NULL
   - price numeric default 0
   - package_duration integer default 30 (15 or 30)
   - info text default ''
   - image_url text default ''
   - project_id uuid
   - created_by uuid
   - created_at timestamptz default now()
   - updated_at timestamptz default now()

9. orders
   - id uuid PK
   - customer_name text NOT NULL
   - mobile text NOT NULL
   - address text default ''
   - order_source text default 'Website'
   - product_id uuid
   - product_title text default ''
   - price numeric default 0
   - note text default ''
   - followup_step integer default 1
   - followup_date date
   - assigned_to uuid
   - assigned_to_name text default ''
   - order_date date default CURRENT_DATE
   - delivery_date date
   - delivery_method text default ''
   - parent_order_id uuid (self-ref for repeat orders)
   - is_repeat boolean default false
   - is_upsell boolean default false
   - is_deleted boolean default false
   - health text default 'new' (new/good/at-risk)
   - current_status text default 'pending' (pending/completed)
   - item_description text default ''
   - product_sku text default ''
   - order_sequence_number integer default 0
   - generated_order_id text default '' (format: SKU*sequence)
   - invoice_id text default 'ORD-' || random 5 digits
   - customer_id uuid
   - project_id uuid
   - paid_amount numeric default 0
   - next_followup_datetime timestamptz (for test mode)
   - created_by uuid
   - created_at timestamptz default now()
   - updated_at timestamptz default now()

10. followup_history
    - id uuid PK
    - order_id uuid NOT NULL
    - step_number integer NOT NULL
    - note text default ''
    - problems_discussed text default ''
    - upsell_attempted boolean default false
    - upsell_details text default ''
    - next_followup_date date
    - completed_by uuid
    - completed_by_name text default ''
    - completed_at timestamptz default now()
    - edited_by uuid
    - edited_at timestamptz
    - created_at timestamptz default now()

11. upsell_records
    - id uuid PK
    - followup_id uuid NOT NULL
    - product_id uuid
    - product_name text default ''
    - price numeric default 0
    - note text default ''
    - added_by uuid
    - created_at timestamptz default now()

12. repeat_order_records
    - id uuid PK
    - followup_id uuid NOT NULL
    - product_id uuid
    - product_name text default ''
    - price numeric default 0
    - note text default ''
    - child_order_id uuid
    - added_by uuid
    - created_at timestamptz default now()

13. delivery_methods
    - id uuid PK
    - name text NOT NULL
    - contact_info text default ''
    - notes text default ''
    - is_active boolean default true
    - project_id uuid
    - created_by uuid
    - created_at timestamptz default now()

14. order_sources
    - id uuid PK
    - name text NOT NULL
    - is_active boolean default true
    - is_system boolean default false
    - project_id uuid
    - created_at timestamptz default now()

15. notifications
    - id uuid PK
    - user_id uuid NOT NULL
    - project_id uuid
    - type text default 'info' (info/followup_due/assignment/alert)
    - title text NOT NULL
    - message text default ''
    - order_id uuid
    - is_read boolean default false
    - created_at timestamptz default now()

16. order_activity_logs
    - id uuid PK
    - order_id uuid NOT NULL
    - project_id uuid
    - user_id uuid
    - user_name text default ''
    - action_type text default '' (Order Created, Order Imported, Order Assigned, 
      Followup Completed, Followup Edited, Upsell Added, Repeat Order Created, 
      Order Updated, Order Deleted)
    - action_description text default ''
    - created_at timestamptz default now()

Enable Supabase Realtime on: orders, followup_history, upsell_records, 
repeat_order_records, notifications, role_permissions

Storage buckets: "product-images" (public), "avatars" (public)

==========================================================
SECTION 4: DATABASE FUNCTIONS
==========================================================

1. has_role(_user_id uuid, _role app_role) RETURNS boolean
   SECURITY DEFINER — checks user_roles table

2. get_user_role(_user_id uuid) RETURNS app_role  
   SECURITY DEFINER — returns role from user_roles

3. has_permission(_user_id uuid, _permission text) RETURNS boolean
   SECURITY DEFINER — joins user_roles + role_permissions

4. get_user_project_id(_user_id uuid) RETURNS uuid
   SECURITY DEFINER — returns project_id from profiles

5. find_or_create_customer(p_name text, p_mobile text, p_address text) RETURNS uuid
   Uses pg_advisory_xact_lock on hashtext(p_mobile) to prevent race conditions.
   Creates or updates customer, returns customer ID.

6. generate_sku_order_id() — TRIGGER on orders BEFORE INSERT
   Auto-generates generated_order_id = SKU*sequence based on product_sku.

7. advance_followup_steps() RETURNS integer
   Updates orders where current_status='completed' AND followup_history has 
   next_followup_date <= CURRENT_DATE. Sets followup_step+1, status='pending', 
   updated_at=now(). Returns count of affected rows.

8. bulk_update_orders(p_order_ids uuid[], p_updates jsonb) RETURNS integer
   Mass updates orders with provided fields.

9. bulk_complete_followups(...) RETURNS integer
   Bulk completes followups for multiple orders.

10. bulk_update_orders_with_lock / bulk_complete_followups_with_lock
    Same as above but with optimistic concurrency via updated_at version checking.

11. update_updated_at_column() — TRIGGER on orders BEFORE UPDATE
    Auto-sets updated_at = now() on every order mutation.

12. handle_new_user() — TRIGGER on auth.users AFTER INSERT
    Creates profile. If no owner exists, assigns owner role. If owner exists and 
    business_name in metadata, creates a project_request.

==========================================================
SECTION 5: RLS POLICIES
==========================================================

Apply granular RLS per table:

- orders: Admin/SubAdmin can view all project orders. SE can only view assigned orders.
  Admin/SubAdmin can update any. SE can update assigned. Admin can delete.
  Admin/SubAdmin/SE can insert.

- customers: Anyone authenticated can view. Admin/SubAdmin can update. 
  Admin/SubAdmin/SE can insert. Admin can delete.

- products: Authenticated can view. Admin/SubAdmin can insert/update. Admin can delete.

- profiles: Users view/update own. Admins view all. Users insert own.

- user_roles: Users view own. Admins view all, insert, update, delete.

- projects: Owner can CRUD all. Project members can view own (via get_user_project_id).

- project_requests: Owner views all, updates. Users view own, insert own.

- notifications: Users view/update/delete own. Admin/SubAdmin/SE can insert.

- order_activity_logs: Admin/SubAdmin/SE can insert. Users view by project_id match.

- All other tables: Similar role-based patterns using has_role().

==========================================================
SECTION 6: AUTHENTICATION SYSTEM
==========================================================

Use Supabase Auth with email/password. Email verification required (no auto-confirm).

Flow:
1. First user to register becomes "owner" (via handle_new_user trigger)
2. Subsequent registrations include business_name → creates project_request
3. Owner approves → creates project, assigns admin role, links profile to project
4. Admin can then create team members (sub_admin, sales_executive) via edge function

Pages:
- /login — Email/password login
- /register — Dynamic: shows "Create Owner Account" if no owner, else "Register Business"
- /verification-pending — Waiting for email verification
- /pending-approval — Waiting for owner approval (or rejected)
- /forgot-password — Send reset email via supabase.auth.resetPasswordForEmail
- /reset-password — Handle PASSWORD_RECOVERY event, update password

==========================================================
SECTION 7: ROLES AND PERMISSIONS (PBAC)
==========================================================

Roles: owner, admin, sub_admin, sales_executive

Owner: Platform-level. Manages all projects, approvals, users.
Admin: Project-level. Full control of their tenant.
Sub Admin: Limited admin within project.
Sales Executive: Can only see assigned orders, complete followups.

Permission-Based Access Control (PBAC):
- permissions table stores available permission keys with categories
- role_permissions table maps roles to permission keys
- Admin can configure permissions for sub_admin and sales_executive via Roles page
- Admin's own permissions are locked (full access)
- PermissionContext provides hasPermission(key) and hasAnyPermission(...keys)
- ProtectedRoute checks requiredPermission before rendering

Permission keys include:
orders.view, orders.create, orders.edit, orders.delete,
followups.view, followups.complete,
products.view, products.edit,
delivery.view, delivery.edit,
sales.view_performance,
commission.view, commission.manage,
roles.manage, audit.view,
backup.view, backup.export

==========================================================
SECTION 8: NAVIGATION STRUCTURE
==========================================================

Left sidebar (fixed, 240px wide) with collapsible categories persisted in localStorage:

For project users (admin/sub_admin/sales_executive):
  Orders: Dashboard, All Orders, Followups (with sub-items 1st-5th), Repeat Orders, 
          Upsell, Deleted Orders
  Operations: Delivery Methods, Order Sources, Bulk Import
  Performance: Sales Executives, Commission & Targets, Export & Reports
  Access Control: Team, Roles, Audit Logs
  System: Products, Backup Center, Settings

For owner:
  Platform: Owner Dashboard, Registration Requests, Projects

Items filtered by user permissions. Theme switcher and user footer with sign out at bottom.

==========================================================
SECTION 9: PAGES AND FEATURES
==========================================================

9.1 DASHBOARD (/)
- 6 KPI cards: Total Orders, Revenue, Conversion Rate, Repeat Rate, 
  Followup Completion, Upsell Rate
- Clickable KPIs navigate to relevant pages
- Alert cards: Today's Followups, Overdue Followups, New Assignments Today
- Charts: Followup Pipeline (bar), Order Sources (pie), Team Performance (bar),
  Followup Step Overview (progress bars)
- Global search by customer name or mobile → navigate to order detail

9.2 ORDERS (/orders)
- Paginated table (20 per page) with columns: Status badge, Notes popover, 
  Invoice/Product, Customer (with copy/call/WhatsApp actions), Dates, Address, 
  Delivery, Amount, Assigned To
- Click row → /orders/:id
- Global filters: date range, sales executive, product, order source, 
  followup step, delivery method
- Search by customer name, mobile, or order ID
- Create Order dialog with validation (customer name, mobile regex, dates required)
- Edit Order dialog
- Admin-only: Bulk selection with BulkActionBar → BulkEditDialog, 
  BulkSingleFieldDialog (assign, delivery method, source, status)

9.3 ORDER DETAIL (/orders/:id)
- Header with back button, "Complete Step N" button (when pending), Edit/Delete (admin)
- Tabs: Order Info, Followup History, Upsells, Repeat Orders, Activity
- Order Info: all fields, followup progress (5 steps), assignment dropdown (admin),
  parent/child order links
- Followup History: chronological entries with upsell/repeat inline, admin edit button
- Activity tab: OrderActivityTimeline showing all actions with exact timestamps 
  (DD MMM YYYY • HH:MM:SS), action-specific icons and color badges

9.4 FOLLOWUPS (/followups?step=1-5)
- 5 step pills showing pending counts, synced with URL query param
- Pending/Completed tabs within each step
- Complete followup dialog: mandatory note, problems discussed, optional upsell entries 
  (product selector, price, note), optional repeat order entries, next followup date 
  (required except step 5)
- Completing a followup: inserts followup_history, creates upsell_records, creates 
  child orders for repeat entries, updates order status to "completed"
- Admin bulk actions on pending followups

9.5 REPEAT ORDERS (/repeat-orders)
- Lists orders where is_repeat = true
- Shows parent order link

9.6 UPSELL (/upsell)
- Lists all upsell records across followups

9.7 PRODUCTS (/products)
- CRUD for products with SKU, title, price, package duration (15/30 days), info, image
- Image upload to product-images storage bucket
- Products scoped by project_id

9.8 DELIVERY METHODS (/delivery-methods)
- CRUD with name, contact info, notes, active toggle
- Scoped by project_id

9.9 ORDER SOURCES (/order-sources)
- CRUD with name, active toggle
- System sources cannot be deleted
- Scoped by project_id

9.10 BULK IMPORT (/bulk-import)
- CSV upload with auto column mapping
- Required fields: Customer Name, Mobile, Address
- Optional: Product, Price, Source, Dates, Delivery Method, Description
- Preview table with validation errors per row
- Optional: assign all to an executive, override delivery method
- Uses find_or_create_customer RPC for each row
- Independent row processing: valid rows succeed even if others fail
- Detailed results report (success/error per row)
- Imported orders default to Step 1 Pending, unassigned

9.11 TEAM (/team)
- Admin can create team members via edge function (email, password, name, role)
- List team members with role, reset password, toggle ban, update role
- Members scoped to admin's project

9.12 ROLES (/roles)
- Permission matrix: categories × roles (sub_admin, sales_executive)
- Admin role is locked (all permissions)
- Toggle individual permissions or entire categories
- Save updates role_permissions table

9.13 SALES EXECUTIVES (/sales-executives, /sales-executives/:id)
- List executives with assigned order count, completed followup count
- Detail page: individual performance metrics, assigned orders list

9.14 COMMISSION (/commission)
- Commission configuration per executive (percentage/fixed, rate)
- Commission entries table (pending/paid status)
- Payment management

9.15 DELETED ORDERS (/deleted-orders)
- Lists soft-deleted orders
- Restore or permanently delete

9.16 AUDIT LOGS (/audit-logs)
- Client-side audit log via AuditLogContext
- Tracks all admin actions with timestamps

9.17 EXPORT (/export)
- Export data to CSV/reports

9.18 BACKUP CENTER (/backup-center)
- Backup management interface

9.19 SETTINGS (/settings)
- Profile: name, phone, avatar upload to avatars bucket
- Email report automation config (frequency, recipients)

9.20 CUSTOMER PROFILE (/customers/:id)
- Customer detail with order history

==========================================================
SECTION 10: OWNER CONTROL PANEL
==========================================================

Separate layout (OwnerLayout) with its own sidebar.

10.1 Owner Dashboard (/owner)
- 6 stat cards: Total Projects, Active, Suspended, Pending Requests, Total Users, 
  Total Orders
- Charts: Orders Growth (bar, 6 months), New Projects per Month (line)
- Data fetched via manage-team edge function "dashboard_stats" action

10.2 Registration Requests (/owner/requests)
- List pending/approved/rejected requests
- Approve: creates project, assigns admin role, links profile to project
- Reject: updates status

10.3 Projects (/owner/projects)
- List all projects with admin name, user count, order count
- Actions: Suspend/Activate toggle, Delete (removes all data), Reset (wipes orders/
  customers/products but keeps users), Edit business name, Transfer admin

10.4 Users (/owner/users)
- List all platform users (except owner)
- Filter by project
- Create user, edit, change role, reset password, ban/unban, delete

10.5 System Logs (/owner/logs)
- Aggregated logs: recent orders, project changes, user logins, role assignments
- Sorted by timestamp descending

==========================================================
SECTION 11: EDGE FUNCTIONS
==========================================================

11.1 manage-team
- Handles all admin and owner operations requiring service role
- Public actions: check_admin_exists, check_owner_exists
- Owner actions: list_requests, approve_request, reject_request, list_projects, 
  toggle_project, delete_project, reset_project, update_project, dashboard_stats,
  owner_list_users, owner_create_user, owner_update_user, owner_update_role,
  owner_reset_password, owner_toggle_ban, owner_delete_user, owner_transfer_admin,
  owner_system_logs
- Admin actions: create (team member), reset_password, update_role, update_user, 
  list_users, toggle_ban
- Auth: validates JWT via anon client, checks caller role from user_roles

11.2 advance-followups
- Called by pg_cron every minute
- Calls advance_followup_steps() RPC
- If orders advanced, creates followup_due notifications for assigned SE and project admins
- Schedule via pg_cron + pg_net:
  SELECT cron.schedule('advance-followups', '* * * * *', $$
    SELECT net.http_post(
      url:='https://<project-ref>.supabase.co/functions/v1/advance-followups',
      headers:='{"Content-Type":"application/json","Authorization":"Bearer <anon_key>"}'::jsonb,
      body:='{}'::jsonb
    );
  $$);

==========================================================
SECTION 12: REALTIME NOTIFICATIONS
==========================================================

- notifications table with Realtime enabled
- useNotifications hook: fetches user's notifications, subscribes to INSERT/UPDATE
- NotificationPanel: bell icon with unread badge in app header, dropdown with 
  mark-as-read and mark-all-read
- Notification triggers: order assignment (notifies executive + admin), followup due 
  (via advance-followups edge function)
- Dashboard alert cards for today's followups and overdue followups

==========================================================
SECTION 13: ORDER ACTIVITY TRACKING
==========================================================

- order_activity_logs table stores all lifecycle events
- useActivityLog hook for inserting logs
- Logged actions: Order Created, Order Imported, Order Assigned, Order Unassigned, 
  Followup Completed, Followup Edited, Upsell Added, Repeat Order Created, 
  Order Updated, Order Deleted
- Each log stores: user_name, action_type, action_description, server timestamp
- OrderActivityTimeline component: fetches logs for an order, displays reverse-
  chronological timeline with action-specific Lucide icons and color badges
- Timestamp format: DD MMM YYYY • HH:MM:SS
- Filtered by project_id via RLS

==========================================================
SECTION 14: ORDER ASSIGNMENT LOGIC
==========================================================

- Orders are unassigned by default (assigned_to = null)
- Admin assigns via dropdown on Order Detail page or bulk assign
- Assignment updates orders.assigned_to and assigned_to_name
- Triggers: notification to assigned SE, activity log entry
- RLS enforces: SE can only see/update their assigned orders
- Admin has "Unassigned" filter to manage distribution
- Assignment changes update updated_at for sort ordering

==========================================================
SECTION 15: FOLLOWUP AUTOMATION
==========================================================

Date-based followup engine:
1. Admin/SE completes a followup step → sets next_followup_date
2. Order status becomes "completed" for current step
3. pg_cron runs advance_followup_steps() every minute
4. When CURRENT_DATE >= next_followup_date:
   - Order advances to next step (followup_step + 1)
   - Status resets to "pending"
   - Notifications sent to assigned SE and project admins
5. Order automatically appears in the correct followup step section
6. Step 5 is final — no next date, health set to "good"

==========================================================
SECTION 16: SORTING AND ORDERING
==========================================================

- All order lists sorted by updated_at DESC (latest activity on top)
- updated_at auto-updated via database trigger on every order mutation
- Actions that update updated_at: create, edit, assign, followup complete, 
  upsell, repeat order
- Ensures newly created, imported, assigned, or followed-up orders appear first

==========================================================
SECTION 17: BULK ACTIONS
==========================================================

- Multi-select checkboxes on order tables
- Fixed bottom BulkActionBar appears on selection
- Bulk Edit: checkbox-gated modal for mass field updates
- Bulk Assign: assign selected orders to an executive
- Bulk Delivery Method / Source / Status changes via BulkSingleFieldDialog
- Bulk Complete Followup: complete a step for all selected orders
- Optimistic concurrency: bulk_*_with_lock functions check updated_at versions,
  report conflicts, allow force-retry
- Each bulk action generates individual audit entries

==========================================================
SECTION 18: CONTEXTS AND STATE MANAGEMENT
==========================================================

Provider hierarchy: QueryClient > BrowserRouter > AuthProvider > RoleProvider > 
  PermissionProvider > AuditLogProvider > OrderStoreProvider > ProductStoreProvider

- AuthContext: session, user, role, profile, loading states, signOut, refreshRole
- RoleContext: derived isAdmin boolean
- PermissionContext: fetches role_permissions, provides hasPermission/hasAnyPermission,
  subscribes to realtime changes on role_permissions table
- AuditLogContext: client-side action logging
- OrderStoreContext: all order CRUD, followup operations, realtime subscriptions 
  for orders/history/upsells/repeats, scoped by project_id
- ProductStoreContext: product CRUD, scoped by project_id

==========================================================
SECTION 19: UI COMPONENT LIBRARY
==========================================================

Use shadcn/ui components: Button, Input, Select, Dialog, Sheet, Table, Tabs, 
Card, Badge, Checkbox, Popover, Calendar, Toast, Sonner, Tooltip, Avatar, 
ScrollArea, DropdownMenu, Separator, Progress, Switch, Label, Textarea, 
Accordion, Alert, AlertDialog, Command

Charts: recharts (BarChart, PieChart, LineChart, ResponsiveContainer)

Custom components:
- AppLayout: sidebar + main content area with left padding
- AppSidebar: collapsible category navigation
- PageHeader: title + description + optional KPI cards
- GlobalFilters: date range, executive, product, source, step, delivery method
- OrderTable: paginated, selectable, with inline actions
- NotificationPanel: bell icon dropdown
- ThemeSwitcher: light/dark/system toggle
- ProtectedRoute: auth + role + permission guard

==========================================================
SECTION 20: TECHNICAL REQUIREMENTS
==========================================================

- React Router v6 for routing
- TanStack React Query for server state (QueryClient)
- Supabase JS client v2 for all backend operations
- date-fns for date formatting
- Lucide React for icons
- All timestamps use server time (now() in Postgres)
- Optimistic concurrency control via updated_at on orders
- Advisory locks for customer creation (pg_advisory_xact_lock)
- Auto-generated Order IDs: SKU*sequence format via trigger
- Random invoice IDs: ORD-XXXXX format
- Mobile-responsive design with Tailwind
- CSS variables for theming (sidebar, card, accent colors)
- Error handling with toast notifications throughout
- Loading states with Loader2 spinner
- Empty states with descriptive messages

Build this system step by step, starting with:
1. Database schema and functions
2. Auth system with registration flow
3. Edge functions (manage-team, advance-followups)
4. Core contexts (Auth, Role, Permission, OrderStore, ProductStore)
5. Navigation and layout
6. Dashboard
7. Orders CRUD with detail page
8. Followup engine with completion dialog
9. Upsell and repeat order system
10. Team management and roles
11. Notifications
12. Activity tracking
13. Bulk import and bulk actions
14. Owner control panel
15. Settings and remaining pages
```

