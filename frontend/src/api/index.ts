import client from './client';
import type {
  Vessel, Manifest, Vehicle, Driver, Operation, Delivery, Icdv,
  PaginatedResponse, UserRecord, DashboardData,
} from '../types';

export { authApi } from './auth';

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  get:           () => client.get<DashboardData>('/dashboard'),
  vehicleStatus: () => client.get('/dashboard/vehicle-status'),
};

// ── ICDVs — Super Admin only ──────────────────────────────────────────────────
export const icdvsApi = {
  list:        (params?: any)              => client.get<PaginatedResponse<Icdv>>('/icdvs', { params }),
  get:         (id: number)                => client.get<Icdv>(`/icdvs/${id}`),
  create:      (data: Partial<Icdv>)       => client.post<Icdv>('/icdvs', data),
  update:      (id: number, data: Partial<Icdv>) => client.patch<Icdv>(`/icdvs/${id}`, data),
  delete:      (id: number)                => client.delete(`/icdvs/${id}`),
  stats:       ()                          => client.get('/icdvs/stats'),
  getUsers:    (id: number, params?: any)  => client.get(`/icdvs/${id}/users`, { params }),
  createAdmin: (id: number, data: any)     => client.post(`/icdvs/${id}/admins`, data),
};

// ── Vessels ───────────────────────────────────────────────────────────────────
export const vesselsApi = {
  list:         (params?: any)                   => client.get<PaginatedResponse<Vessel>>('/vessels', { params }),
  get:          (id: number)                     => client.get<Vessel>(`/vessels/${id}`),
  create:       (data: Partial<Vessel>)          => client.post<Vessel>('/vessels', data),
  update:       (id: number, data: Partial<Vessel>) => client.patch<Vessel>(`/vessels/${id}`, data),
  updateStatus: (id: number, status: string)     => client.patch<Vessel>(`/vessels/${id}/status`, { status }),
  delete:       (id: number)                     => client.delete(`/vessels/${id}`),
};

// ── Manifests ─────────────────────────────────────────────────────────────────
export const manifestsApi = {
  list:           (params?: any)                      => client.get<PaginatedResponse<Manifest>>('/manifests', { params }),
  get:            (id: number)                        => client.get<Manifest>(`/manifests/${id}`),
  getNextNumber:  ()                                  => client.get<{ manifest_number: string }>('/manifests/next-number'),
  create:         (data: Partial<Manifest>)           => client.post<Manifest>('/manifests', data),
  update:         (id: number, data: Partial<Manifest>) => client.patch<Manifest>(`/manifests/${id}`, data),
  delete:         (id: number)                        => client.delete(`/manifests/${id}`),
  previewCSV:     (id: number, formData: FormData)    => client.post(`/manifests/${id}/preview-csv`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  importVehicles: (id: number, formData: FormData)    => client.post(`/manifests/${id}/import-vehicles`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

// ── Vehicles ──────────────────────────────────────────────────────────────────
export const vehiclesApi = {
  list:             (params?: any)                      => client.get<PaginatedResponse<Vehicle>>('/vehicles', { params }),
  get:              (id: number)                        => client.get<Vehicle>(`/vehicles/${id}`),
  searchByChassis:  (chassis: string)                   => client.get<Vehicle>(`/vehicles/search/${chassis}`),
  create:           (data: Partial<Vehicle>)            => client.post<Vehicle>('/vehicles', data),
  update:           (id: number, data: Partial<Vehicle>) => client.patch<Vehicle>(`/vehicles/${id}`, data),
  delete:           (id: number)                        => client.delete(`/vehicles/${id}`),
  getOperations:    (id: number)                        => client.get<Operation[]>(`/vehicles/${id}/operations`),
};

// ── Drivers ───────────────────────────────────────────────────────────────────
export const driversApi = {
  list:   (params?: any)                     => client.get<PaginatedResponse<Driver>>('/drivers', { params }),
  get:    (id: number)                       => client.get<Driver>(`/drivers/${id}`),
  create: (data: Partial<Driver>)            => client.post<Driver>('/drivers', data),
  update: (id: number, data: Partial<Driver>) => client.patch<Driver>(`/drivers/${id}`, data),
  delete: (id: number)                       => client.delete(`/drivers/${id}`),
};

// ── Operations ────────────────────────────────────────────────────────────────
export const operationsApi = {
  list:         (params?: any)                        => client.get<PaginatedResponse<Operation>>('/operations', { params }),
  get:          (id: number)                          => client.get<Operation>(`/operations/${id}`),
  create:       (data: Partial<Operation>)            => client.post<Operation>('/operations', data),
  update:       (id: number, data: Partial<Operation>) => client.patch<Operation>(`/operations/${id}`, data),
  updateStatus: (id: number, status: string, notes?: string) =>
    client.patch<Operation>(`/operations/${id}/status`, { status, notes }),
  delete:       (id: number)                          => client.delete(`/operations/${id}`),
};

// ── Deliveries ────────────────────────────────────────────────────────────────
export const deliveriesApi = {
  list:         (params?: any)                        => client.get<PaginatedResponse<Delivery>>('/deliveries', { params }),
  get:          (id: number)                          => client.get<Delivery>(`/deliveries/${id}`),
  create:       (data: Partial<Delivery>)             => client.post<Delivery>('/deliveries', data),
  update:       (id: number, data: Partial<Delivery>) => client.patch<Delivery>(`/deliveries/${id}`, data),
  updateStatus: (id: number, status: string, data?: any) =>
    client.patch<Delivery>(`/deliveries/${id}/status`, { status, ...data }),
  delete:       (id: number)                          => client.delete(`/deliveries/${id}`),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  list:         (params?: any)                                        => client.get<PaginatedResponse<UserRecord>>('/users', { params }),
  get:          (id: number)                                          => client.get<UserRecord>(`/users/${id}`),
  create:       (data: Partial<UserRecord> & { password?: string })   => client.post<UserRecord>('/users', data),
  update:       (id: number, data: Partial<UserRecord>)               => client.patch<UserRecord>(`/users/${id}`, data),
  delete:       (id: number)                                          => client.delete(`/users/${id}`),
  getSkills:    ()                                                     => client.get('/users/meta/skills'),
  updateSkills: (userId: number, skillIds: number[])                  => client.put(`/users/${userId}/skills`, { skillIds }),
};

// ── Lookups ───────────────────────────────────────────────────────────────────
export const lookupsApi = {
  sectors: () => client.get('/lookups/sectors'),
  regions: () => client.get('/lookups/regions'),
};
