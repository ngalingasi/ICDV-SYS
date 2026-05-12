// ── Auth ──────────────────────────────────────────────────────────────────────
export interface User {
  user_id:              number;
  full_name:            string;
  username:             string;
  email:                string;
  mobile?:              string;
  gender?:              string;
  avatar?:              string | null;
  role:                 'admin' | 'supervisor' | 'operator' | 'super_admin' | 'manager';
  icdv_id?:             number | null;
  icdv_name?:           string | null;
  status:               'active' | 'inactive';
  must_change_password: number;
}

export interface TokenPair  { token: string; expires: string; }
export interface AuthTokens { access: TokenPair; refresh: TokenPair; }
export interface AuthResponse { user: User; tokens: AuthTokens; }
export interface OtpChannel { type: 'email' | 'sms'; display: string; label: string; }

// ── Pagination ────────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  results: T[];
  page: number;
  limit: number;
  totalPages: number;
  totalResults: number;
}

// ── ICDV (tenant) ─────────────────────────────────────────────────────────────
export interface Icdv {
  icdv_id:        number;
  name:           string;
  code:           string;
  address?:       string | null;
  phone?:         string | null;
  email?:         string | null;
  logo_path?:     string | null;
  country?:       string | null;
  city?:          string | null;
  is_active:      number;
  settings?:      any | null;
  user_count?:    number;
  vessel_count?:  number;
  vehicle_count?: number;
  driver_count?:  number;
  created_at?:    string;
}

// ── Vessel ────────────────────────────────────────────────────────────────────
export type VesselStatus = 'expected' | 'arrived' | 'processing' | 'completed' | 'departed';

export interface Vessel {
  vessel_id:        number;
  icdv_id?:         number;
  name:             string;
  imo_number?:      string | null;
  flag?:            string | null;
  vessel_type?:     string | null;
  country_of_origin?: string | null;
  shipping_line?:   string | null;
  arrival_date:     string;
  departure_date?:  string | null;
  berth_number?:    string | null;
  port_of_origin?:  string | null;
  notes?:           string | null;
  status:           VesselStatus;
  manifest_count?:  number;
  vehicle_count?:   number;
  created_by?:      number;
  created_by_name?: string;
  created_at?:      string;
  updated_at?:      string;
}

// ── Manifest ──────────────────────────────────────────────────────────────────
export type ManifestStatus = 'pending' | 'active' | 'completed' | 'cancelled';

export interface Manifest {
  manifest_id:        number;
  id?:                number;   // alias
  icdv_id?:           number;
  manifest_number:    string;
  vessel_id:          number;
  vessel_name?:       string;
  arrival_date:       string;
  notes?:             string | null;
  status:             ManifestStatus;
  total_vehicles?:    number;
  released_vehicles?: number;
  delivered_vehicles?:number;
  created_by_name?:   string;
  created_at?:        string;
}

// ── Vehicle ───────────────────────────────────────────────────────────────────
export type ReleaseStatus     = 'unreleased' | 'released' | 'collected' | 'on_hold';
export type OperationalStatus = 'pending' | 'in_operation' | 'ready' | 'delivered' | 'cancelled';
export type WorkflowStatus    = 'manifested' | 'discharged' | 'batched' | 'in_transit' | 'received';
export type VehicleLocation   = 'vessel' | 'holding_ground' | 'tpa_gate' | 'tpa_gate_to_yard' | 'icdv_yard';

export interface Vehicle {
  vehicle_id:          number;
  id?:                 number;   // alias
  icdv_id?:            number;
  manifest_id:         number;
  manifest_number?:    string;
  vessel_name?:        string;
  chassis_number:      string;
  engine_number?:      string | null;
  brand?:              string | null;
  model?:              string | null;
  year?:               number | null;
  color?:              string | null;
  customer_name?:      string | null;
  destination?:        string | null;
  delivery_location?:  string | null;
  bill_of_lading_no?:  string | null;
  release_status:      ReleaseStatus;
  operational_status:  OperationalStatus;
  workflow_status:     WorkflowStatus;
  current_location:    VehicleLocation;
  batch_id?:           number | null;
  notes?:              string | null;
  created_by_name?:    string;
  created_at?:         string;
}

// ── Driver ────────────────────────────────────────────────────────────────────
export type DriverStatus = 'active' | 'inactive' | 'suspended';

export interface Driver {
  driver_id:         number;
  icdv_id?:          number;
  full_name:         string;
  name?:             string;   // alias used in some pages
  license_number:    string;
  phone?:            string | null;
  email?:            string | null;
  id_number?:        string | null;
  photo?:            string | null;
  status:            DriverStatus;
  notes?:            string | null;
  total_operations?: number;
  created_by_name?:  string;
  created_at?:       string;
}

// ── Operation (old — kept for future use) ─────────────────────────────────────
export type OperationStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface Operation {
  operation_id:     number;
  id?:              number;   // alias
  icdv_id?:         number;
  vehicle_id:       number;
  chassis_number?:  string;
  brand?:           string;
  model?:           string;
  driver_id?:       number | null;
  driver_name?:     string | null;
  license_number?:  string | null;
  operation_type:   string;
  scheduled_date?:  string | null;
  completed_date?:  string | null;
  notes?:           string | null;
  assigned_to?:     string | null;
  status:           OperationStatus;
  manifest_number?: string;
  vessel_name?:     string;
  created_by_name?: string;
  created_at?:      string;
  updated_at?:      string;
}

// ── Delivery ──────────────────────────────────────────────────────────────────
export type DeliveryStatus = 'scheduled' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';

export interface Delivery {
  delivery_id:        number;
  id?:                number;   // alias
  icdv_id?:           number;
  vehicle_id:         number;
  chassis_number?:    string;
  brand?:             string;
  model?:             string;
  customer_name?:     string;
  driver_id?:         number | null;
  driver_name?:       string | null;
  scheduled_date?:    string | null;
  delivered_date?:    string | null;
  delivery_address?:  string | null;
  recipient_name?:    string | null;
  recipient_phone?:   string | null;
  notes?:             string | null;
  delivery_notes?:    string | null;
  status:             DeliveryStatus;
  manifest_number?:   string;
  vessel_name?:       string;
  created_by_name?:   string;
  created_at?:        string;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export interface DashboardStats {
  // Totals
  total_vessels:       number;
  total_manifests:     number;
  total_vehicles:      number;
  released_vehicles:   number;
  delivered_vehicles:  number;
  unreleased_vehicles: number;
  // Workflow step counts
  manifested_count:    number;
  discharged_count:    number;
  batched_count:       number;
  in_transit_count:    number;
  received_count:      number;
  open_batches:        number;
}

export interface DashboardData {
  stats:              DashboardStats;
  recent_vessels:     Vessel[];
  workflow_by_status: { workflow_status: string; count: number }[];
  // operations_by_type removed from dashboard (kept in operations module)
}

// ── User Record ───────────────────────────────────────────────────────────────
export interface UserRecord {
  user_id:              number;
  full_name:            string;
  username:             string;
  email?:               string;
  mobile?:              string;
  gender?:              string;
  role:                 'admin' | 'supervisor' | 'operator' | 'super_admin' | 'manager';
  icdv_id?:             number | null;
  icdv_name?:           string | null;
  status:               'active' | 'inactive';
  must_change_password?: number;
  skills?:              { skill_id: number; name: string }[];
  created_at?:          string;
}

// ── Lookup ────────────────────────────────────────────────────────────────────
export interface Sector      { sector_id: number; name: string; parent_sector_id?: number | null; }
export interface Region      { region_id: number; region_name: string; }
export interface Implementer {
  implementer_id:   number;
  name:             string;
  description?:     string | null;
  cost_center?:     string | null;
  vote_code?:       string | null;
  vote_name?:       string | null;
  sub_vote_code?:   string | null;
  sub_vote_name?:   string | null;
  link_id?:         number | null;
  involvement?:     string | null;
}

// ── Project & related ─────────────────────────────────────────────────────────
export interface ProjectFinancing {
  financing_id?:       number;
  _key?:               string;
  source_name?:        string;
  fund_source?:        string | null;
  financier?:          string | null;
  financial_modality?: string | null;
  financial_category?: string | null;
  amount?:             number;
  committed_amount?:   number | null;
  amount_tzs?:         number | null;
  exchange_rate?:      number | null;
  currency?:           string | null;
  notes?:              string | null;
}

export interface ProjectCoordinator {
  coordinator_id?: number;
  _key?:           string;
  user_id?:        number;
  name?:           string;
  full_name?:      string | null;
  role?:           string | null;
  email?:          string | null;
  phone_number?:   string | null;
  address?:        string | null;
}

export interface ProjectEmployment {
  employment_id?:  number;
  _key?:           string;
  category?:       string;
  type?:           string | null;
  foreign_count:   number;
  domestic_count:  number;
}

export interface Project {
  project_id:              number;
  icdv_id?:                number;
  name:                    string;
  programme_name?:         string | null;
  project_reference?:      string | null;
  project_nature?:         string | null;
  code?:                   string | null;
  description?:            string | null;
  status:                  string;
  start_date?:             string | null;
  end_date?:               string | null;
  budget?:                 number | null;
  estimated_cost?:         number | null;
  fund_structure?:         string | null;
  funding?:                string | null;
  sub_sector?:             string | null;
  cost_center?:            string | null;
  implementation_modality?: string | null;
  has_land?:               boolean | number | null;
  job_created_no?:         number | null;
  compensation?:           string | null;
  relevancy_fypds?:        string | null;
  project_background?:     string | null;
  project_objectives?:     string | null;
  project_scope?:          string | null;
  project_main_activities?: string | null;
  project_beneficiaries?:  string | null;
  project_use_capacity?:   string | null;
  project_life_span?:      string | null;
  sector_id?:              number | null;
  sector_name?:            string | null;
  implementer_id?:         number | null;
  project_manager_name?:   string | null;
  regions?:                Region[];
  implementers?:           (Implementer & { involvement?: string | null; link_id?: number | null })[];
  coordinators?:           ProjectCoordinator[];
  financing?:              ProjectFinancing[];
  employment?:             ProjectEmployment[];
  created_at?:             string;
  updated_at?:             string;
}

export interface Objective {
  objective_id: number;
  project_id:   number;
  title:        string;
  description?: string | null;
  status?:      string | null;
  priority?:    string | null;
  created_at?:  string;
}

export interface Target {
  target_id:        number;
  objective_id:     number;
  project_id?:      number;
  title:            string;
  name?:            string | null;
  description?:     string | null;
  unit?:            string | null;
  target_value?:    number | null;
  current_value?:   number | null;
  allocated_budget?: number | null;
  status?:          string | null;
  deadline?:        string | null;
  created_at?:      string;
}

export type ActivityStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold' | 'overdue' | 'pending';

export interface Activity {
  activity_id:         number;
  main_activity_id?:   number | null;
  target_id:           number;
  project_id?:         number;
  title:               string;
  name?:               string | null;
  description?:        string | null;
  status:              ActivityStatus;
  start_date?:         string | null;
  end_date?:           string | null;
  budget?:             number | null;
  budgeted_amount?:    number | null;
  effective_budget?:   number | null;
  revised_amount?:     number | null;
  notes?:              string | null;
  progress?:           number | null;
  assigned_user_id?:   number | null;
  assigned_user_name?: string | null;
  supervisor_name?:    string | null;
  target_name?:        string | null;
  region_name?:        string | null;
  council?:            string | null;
  ward?:               string | null;
  street?:             string | null;
  road_name?:          string | null;
  latitude?:           number | null;
  longitude?:          number | null;
  created_at?:         string;
  updated_at?:         string;
}

export interface ActivityStatusHistory {
  history_id?:       number;
  id?:               number;
  activity_id:       number;
  old_status?:       ActivityStatus | null;
  new_status:        ActivityStatus;
  changed_by?:       string;
  changed_by_name?:  string | null;
  notes?:            string | null;
  created_at?:       string;
  changed_at?:       string;
}

export interface ProjectBudgetSummary {
  project_id:            number;
  total_budget:          number;
  spent_budget?:         number;
  total_spent?:          number | null;
  remaining_budget?:     number | null;
  remaining:             number;
  allocated_to_targets?: number | null;
  spent_percentage?:     number | null;
  currency?:             string;
}

export interface BudgetRevision {
  revision_id:         number;
  project_id?:         number;
  activity_id?:        number;
  activity_name?:      string | null;
  amount:              number;
  requested_amount?:   number | null;
  current_amount?:     number | null;
  difference?:         number | null;
  reason:              string;
  review_notes?:       string | null;
  status:              'pending' | 'approved' | 'rejected';
  requested_by?:       string;
  requested_by_name?:  string | null;
  reviewed_by?:        string | null;
  reviewed_by_name?:   string | null;
  reviewed_at?:        string | null;
  created_at?:         string;
  updated_at?:         string;
}

// ── API Error ─────────────────────────────────────────────────────────────────
export interface ApiErrorResponse {
  message: string;
  errors?:  Record<string, string[]>;
  status?:  number;
}
