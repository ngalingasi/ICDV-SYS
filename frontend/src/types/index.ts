// ── Auth ──────────────────────────────────────────────────────────────────────
export interface User {
  user_id:              number;
  full_name:            string;
  username:             string;
  email:                string;
  mobile?:              string;
  gender?:              string;
  avatar?:              string | null;
  role:                 'admin' | 'supervisor' | 'operator' | 'super_admin';
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
  status:           OperationStatus;
  manifest_number?: string;
  vessel_name?:     string;
  created_by_name?: string;
  created_at?:      string;
}

// ── Delivery ──────────────────────────────────────────────────────────────────
export type DeliveryStatus = 'scheduled' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';

export interface Delivery {
  delivery_id:        number;
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
  role:                 'admin' | 'supervisor' | 'operator' | 'super_admin';
  icdv_id?:             number | null;
  status:               'active' | 'inactive';
  must_change_password?: number;
  created_at?:          string;
}

// ── Lookup ────────────────────────────────────────────────────────────────────
export interface Sector      { sector_id: number; name: string; }
export interface Region      { region_id: number; region_name: string; }
export interface Implementer { implementer_id: number; name: string; }
