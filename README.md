# Construct Pro

Voici le prompt ultra-complet, optimisé spécifiquement pour Lovable.app :

Prompt Lovable — ConstructFlow MVP

Build a professional SaaS web application called "ConstructFlow" — a construction site management platform for Belgian construction companies.

---

## TECH STACK
- React + TypeScript + Vite
- Tailwind CSS (custom config below)
- Supabase (Auth + PostgreSQL database)
- Recharts for charts
- React Router v6 for navigation
- Lucide React for icons
- date-fns for date formatting
- React Hook Form + Zod for forms

---

## DESIGN SYSTEM

Colors (add to tailwind.config.js):
- sidebar-bg: #1a2332 (dark navy)
- sidebar-text: #8892a4
- sidebar-active: #0891b2
- page-bg: #f8f9fa
- card-bg: #ffffff
- accent: #0891b2 (teal)
- accent-hover: #0e7490
- text-primary: #111827
- text-secondary: #6b7280
- border: #e5e7eb
- success: #10b981
- warning: #f59e0b
- danger: #ef4444
- info: #3b82f6

Typography: font-family Inter (import from Google Fonts)

Global styles:
- Sidebar: fixed left, 240px wide, bg #1a2332, full height
- Main content: margin-left 240px, min-height 100vh, bg #f8f9fa, padding 24px
- Cards: bg white, rounded-xl, border border-gray-100, shadow-sm
- Inputs: rounded-lg, border-gray-200, focus:ring-2 focus:ring-cyan-500
- Buttons primary: bg #0891b2, hover bg #0e7490, text white, rounded-lg
- Badges: rounded-full px-3 py-1 text-xs font-medium

---

## SUPABASE DATABASE SCHEMA

Create these tables:

```sql
-- Companies (multi-tenant)
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bce_number text unique,
  address text,
  logo_url text,
  created_at timestamptz default now()
);

-- User profiles
create table profiles (
  id uuid primary key references auth.users(id),
  company_id uuid references companies(id),
  full_name text,
  role text default 'admin',
  avatar_url text,
  created_at timestamptz default now()
);

-- Chantiers (construction sites)
create table chantiers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  name text not null,
  client_name text,
  address text,
  budget decimal(12,2),
  actual_costs decimal(12,2) default 0,
  start_date date,
  end_date date,
  status text default 'En attente',
  progress integer default 0,
  description text,
  created_at timestamptz default now()
);

-- Etapes (construction phases per site)
create table etapes (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid references chantiers(id) on delete cascade,
  name text not null,
  order_index integer,
  status text default 'En attente',
  progress integer default 0,
  start_date date,
  end_date date,
  notes text
);

-- Personnel
create table personnel (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  full_name text not null,
  nrn text,
  email text,
  phone text,
  contract_type text,
  hourly_rate decimal(8,2),
  photo_url text,
  status text default 'Actif',
  created_at timestamptz default now()
);

-- Presence (attendance)
create table presence (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid references personnel(id) on delete cascade,
  date date not null,
  status text not null, -- 'Présent', 'Absent', 'Congé'
  chantier_id uuid references chantiers(id),
  hours decimal(4,1) default 8,
  unique(personnel_id, date)
);

-- Affectations (worker assignments to sites)
create table affectations (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid references personnel(id),
  chantier_id uuid references chantiers(id),
  start_date date,
  end_date date,
  role text
);


Enable Row Level Security on all tables. Users can only access data from their company_id.

AUTHENTICATION

Login page (/login):

Centered card on dark navy bg (#1a2332)

ConstructFlow logo + tagline "Gérez vos chantiers avec précision"

Email + password fields

"Se connecter" primary button

Error states with red alert

On success, redirect to /dashboard

No self-registration (admin creates accounts)

APP STRUCTURE & ROUTING

/login
/dashboard
/chantiers
/chantiers/:id
/personnel
/personnel/:id
/vehicules (coming soon)
/facturation (coming soon)
/stock (coming soon)
/belcotax (coming soon)


SIDEBAR COMPONENT

Fixed left sidebar, 240px, bg #1a2332:

Top section:

Logo: white "CF" in teal square (32px) + "ConstructFlow" text white 14px bold

Company name below in gray-400 text-xs (from profile)

Navigation items (with Lucide icons):

LayoutDashboard — Dashboard → /dashboard

HardHat — Chantiers → /chantiers

Users — Personnel → /personnel

Truck — Véhicules → /vehicules (coming soon badge)

FileText — Devis & Factures → /facturation (coming soon badge)

Package — Stock → /stock (coming soon badge)

Calculator — Belcotax → /belcotax (coming soon badge)

Nav item styling:

Default: text #8892a4, hover: bg #ffffff10 text white, rounded-lg mx-2 px-3 py-2

Active: bg #0891b2 text white, rounded-lg

"Coming soon" items: show a small gray badge "Bientôt" on the right, clicking shows a centered modal: "Ce module sera disponible dans la prochaine mise à jour."

Bottom section:

User avatar circle (initials) + name + role

LogOut icon button

MODULE 1 — DASHBOARD (/dashboard)

Top KPI Cards (4 cards in grid-cols-4)

Card 1 — CA Total:

Icon: TrendingUp (teal)

Value: sum of all chantiers budgets (formatted: "482 340 €")

Sub: "+12% vs mois dernier"

Card 2 — Bénéfice Total:

Icon: Euro (green)

Value: sum of (budget - actual_costs)

Color green if positive, red if negative

Card 3 — Chantiers Actifs:

Icon: HardHat (teal)

Value: count where status = 'En cours'

Sub: "X en retard" in red

Card 4 — Ouvriers Actifs:

Icon: Users (teal)

Value: count personnel where status = 'Actif'

Sub: "X sans affectation" in orange

Chart Section (2 columns)

Left (2/3 width): Bar chart "CA vs Coûts — 6 derniers mois"

Recharts BarChart

Two bars per month: CA (teal #0891b2) and Coûts (#ef4444)

X axis: month names in French (Jan, Fév, Mar...)

Y axis: formatted in k€

Legend below

Card with title + subtitle "Évolution financière"

Right (1/3 width): "Top 5 Chantiers par rentabilité"

List of 5 chantiers

Each row: chantier name + mini progress bar + rentabilité % badge

Color coded: green >15%, yellow 5-15%, red <5%

Alerts Section (full width)

Title "Alertes & Actions requises" with AlertTriangle icon in orange

Alert cards in a horizontal scroll row:

Red card: "X chantiers en retard" with chantier names

Orange card: "X ouvriers sans affectation cette semaine"

Yellow card: "Bientôt — Véhicules CT à renouveler"

Each alert card: colored left border (4px), icon, text, "Voir →" link

MODULE 2 — CHANTIERS

List Page (/chantiers)

Header: "Chantiers" h1 + count badge (gray) + "Nouveau chantier" button (teal, Plus icon)

Search bar + filters row:

Search input (placeholder "Rechercher un chantier...")

Status filter dropdown: Tous / En cours / En retard / Terminé / En attente

Sort: Date ↓ / Budget ↓ / Progression ↓

Chantiers table (not cards — use a proper table for this): Columns: Chantier | Client | Adresse | Budget | Progression | Statut | Remise | Actions

Table row details:

Chantier: bold name + gray address below

Budget: formatted "245 000 €"

Progression: mini progress bar (h-2, rounded) in teal + "68%" text

Statut badge:

En cours: bg-cyan-100 text-cyan-700

En retard: bg-red-100 text-red-700

Terminé: bg-green-100 text-green-700

En attente: bg-yellow-100 text-yellow-700

Remise: date + "X jours restants" in small text (red if <14 days)

Actions: Eye icon (view), Edit icon (edit)

Row hover: bg-gray-50

"Nouveau chantier" modal/drawer: Fields: Nom du chantier, Nom du client, Adresse, Budget (€), Date de début, Date de remise, Description Submit creates chantier + auto-creates 7 default etapes in correct order

Detail Page (/chantiers/:id)

Header Section

Full-width card:

Left: Chantier name (h1) + client + address (with MapPin icon)

Center: 3 metric boxes side by side:

Budget: "245 000 €" gray label

Dépenses: "162 400 €"

Bénéfice: "82 600 €" (green) or red if negative — this is the "temps réel" indicator with live calculation

Right: Status badge + Edit button + days remaining pill

Progress bar full width below: teal, h-3, rounded, with "68% complété" text right

Timeline — Étapes (phases)

Title "Phases du chantier" with a Progress summary "4/7 étapes complétées"

7 phases displayed as vertical timeline:

Each phase card (clickable to expand): Left: colored circle with number + vertical connector line between phases Colors: gray (En attente), blue (En cours), green (Terminé), red (En retard)

Phase card content:

Phase name bold + status badge right

Collapsed: just name + status + progress bar

Expanded (on click):

Progress slider (0-100%) — changing it updates the phase %

Start date / End date inputs

Notes textarea

"Marquer comme terminé" button (green) or "Démarrer" (blue)

Save button

The 7 default phases in order:

Préparation du site

Fondations

Gros œuvre

Charpente & Toiture

Second œuvre (électricité, plomberie)

Finitions & Peinture

Nettoyage & Réception

Overall chantier progress = average of all phases progress

Documents Section

Title "Plans & Documents" with Upload button (Upload icon)

Upload zone: dashed border, "Glissez vos plans PDF ici ou cliquez pour parcourir"

Uploaded files list: filename + size + upload date + download icon + delete icon

Support: PDF only, max 10MB

Store in Supabase Storage bucket "chantier-documents"

Équipe Affectée Section

Title "Équipe sur ce chantier"

Grid of worker cards: avatar (initials circle) + name + role

"Ajouter un ouvrier" button → modal to select from personnel list

MODULE 3 — PERSONNEL

List Page (/personnel)

Header: "Personnel" + count badge + "Ajouter un ouvrier" button

Search + filter (Actif / Inactif / Tous) + contract type filter

Grid 3 columns of worker cards: Each card:

Top: Avatar circle (initials, bg random from preset palette) + 3-dot menu (Edit / Voir fiche / Désactiver)

Name (bold, 15px) + contract type (gray, 12px)

Status badge: Actif (green) / Inactif (gray)

2 stat boxes: "Chantier actuel" name or "Non affecté" + "Type contrat" (CDI/CDD/Intérim)

Presence bar: last 7 days as small colored squares (green/red/orange/gray)

"Ajouter un ouvrier" modal: Fields: Prénom + Nom, NRN (Numéro de Registre National), Email, Téléphone, Type de contrat (CDI/CDD/Intérim/Indépendant), Taux horaire (€/h), Photo URL (optional)

Detail Page (/personnel/:id)

Header Card

Large avatar (64px initials circle, teal bg)

Full name h1 + contract type + status badge

4 info items: NRN, Email, Téléphone, Taux horaire

Presence Calendar

Title "Présences — [Month Year]" with prev/next month arrows

Monthly calendar grid (7 columns = days of week):

Mon Tue Wed Thu Fri Sat Sun headers

Each day cell (36px square, rounded):

Weekend (Sat/Sun): bg-gray-100 text-gray-300

Présent: bg-green-100 text-green-700 with ✓

Absent: bg-red-100 text-red-600 with ✗

Congé: bg-orange-100 text-orange-600 with ~

Future dates: bg-gray-50 text-gray-300

Clicking a past/today cell opens quick toggle: Présent / Absent / Congé

Below calendar: monthly stats row

"22 jours présents" (green) | "2 absents" (red) | "1 congé" (orange) | "176h travaillées"

Affectations Section

Title "Chantiers affectés"

List of current/past chantier assignments

Each row: chantier name + dates + role + remove button

"Affecter à un chantier" button → select modal

MODALS & SHARED COMPONENTS

Confirmation Modal

Used for delete/destructive actions:

Overlay bg-black/50

Centered card with warning icon

"Êtes-vous sûr ?" title + description

Cancel (gray) + Confirm (red) buttons

Toast Notifications

Bottom-right toasts for success/error:

Success: green left border + CheckCircle icon

Error: red left border + XCircle icon

Auto-dismiss after 3s

Empty States

When lists are empty:

Centered illustration (simple SVG icon, large, gray)

"Aucun chantier pour le moment" title

"Créer votre premier chantier" CTA button

Loading States

Skeleton loaders (gray animated pulse) for cards and table rows

Full-page spinner on initial auth check

SEED DATA

On first login, auto-populate with realistic Belgian construction data:

3 Chantiers:

"Résidence Les Acacias" — Client: Immobilière Dumont SA — Liège — Budget: 245,000€ — Costs: 162,400€ — Status: En cours — Progress: 68% — End date: 15 Aug 2025

"Entrepôt Logistique Seraing" — Client: TechLog BVBA — Seraing — Budget: 180,000€ — Costs: 98,200€ — Status: En retard — Progress: 41% — End date: 1 Jul 2025

"Villa Rénovation Namur" — Client: M. & Mme Pirard — Namur — Budget: 68,000€ — Costs: 56,600€ — Status: Terminé — Progress: 100%

5 Personnel members with realistic Belgian names, NRNs, presence data for current month

IMPORTANT IMPLEMENTATION NOTES

All amounts in EUR with Belgian formatting: "245 000 €" (space as thousands separator, € after)

All dates in Belgian format: DD/MM/YYYY

French language throughout — NO English in UI

Chantier progress = weighted average of all etape progress values

Status "En retard" is auto-calculated: if end_date < today AND progress < 100

Profit calculation: bénéfice = budget - actual_costs, displayed in green if positive, red if negative

The sidebar coming-soon items (Véhicules, Devis & Factures, Stock, Belcotax) must show a modal on click — do NOT navigate or show 404

RLS policies: all queries must filter by company_id from the user's profile

Dashboard chart data: generate monthly aggregates from chantiers data grouped by month

Presence calendar: future days are non-clickable, weekends are non-clickable

When a chantier reaches 100% on all etapes, auto-update status to "Terminé"

Responsive: sidebar collapses to icons-only on screens < 1280px (hamburger menu on mobile)

DELIVERABLE

A fully functional React + Supabase SaaS with: ✓ Working authentication with redirect ✓ 3 complete modules (Dashboard, Chantiers, Personnel) ✓ Sidebar with coming-soon modules ✓ Real Supabase data (not mock/hardcoded) ✓ Professional Belgian construction design ✓ All French UI ✓ Seed data on first load


---

**3 conseils pour utiliser ce prompt sur Lovable :**

Colle-le en une seule fois dans le chat Lovable — il est conçu pour être auto-suffisant. Si Lovable te demande des clarifications, réponds simplement "proceed as specified". Si certains composants sont générés en anglais, suis avec "Translate all UI text to French, keep the exact design".

Pour la phase 2 (Véhicules, Facturation, Stock, ... ), je peux te préparer un prompt de continuation tout aussi détaillé dès que le MVP est validé.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/013b35a1-c64c-4cfe-b0f2-5d8de026de6c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
