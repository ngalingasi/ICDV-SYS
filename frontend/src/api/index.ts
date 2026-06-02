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
  getNextNumber:  (icdvId?: number)                   => client.get<{ manifest_number: string }>('/manifests/next-number', icdvId ? { params: { icdv_id: icdvId } } : undefined),
  create:         (data: Partial<Manifest>)           => client.post<Manifest>('/manifests', data),
  update:         (id: number, data: Partial<Manifest>) => client.patch<Manifest>(`/manifests/${id}`, data),
  delete:         (id: number)                        => client.delete(`/manifests/${id}`),
  previewCSV:     (id: number, formData: FormData)    => client.post(`/manifests/${id}/preview-csv`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  importVehicles: (id: number, formData: FormData)    => client.post(`/manifests/${id}/import-vehicles`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deliverySheet:         (id: number) => client.get(`/manifests/${id}/delivery-sheet`),
  combinedDeliverySheet: (id: number) => client.get(`/manifests/${id}/delivery-sheet/combined`),
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
  list:    (params?: any)  => client.get<PaginatedResponse<Driver>>('/drivers', { params }),
  get:     (id: number)    => client.get<Driver>(`/drivers/${id}`),
  create:  (data: FormData | Partial<Driver>) =>
    client.post<Driver>('/drivers', data,
      data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}),
  update:  (id: number, data: FormData | Partial<Driver>) =>
    client.patch<Driver>(`/drivers/${id}`, data,
      data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}),
  release: (id: number)    => client.patch(`/drivers/${id}/release`),
  delete:  (id: number)    => client.delete(`/drivers/${id}`),
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

// ── Lookups — see extended export below ───────────────────────────────────────

// ── Workflow — 5-step operational flow ───────────────────────────────────────
export const workflowApi = {
  // 1. Discharge
  dischargeLookup:  (chassis: string) =>
    client.get('/workflow/discharge/lookup', { params: { chassis } }),
  dischargeConfirm: (vehicle_id: number, notes?: string) =>
    client.post('/workflow/discharge/confirm', { vehicle_id, notes }),

  // 2. Batch
  batchLookup:   (chassis: string) =>
    client.get('/workflow/batch/lookup', { params: { chassis } }),
  batchConfirm:  (vehicle_id: number, notes?: string) =>
    client.post('/workflow/batch/confirm', { vehicle_id, notes }),
  listBatches:   (params?: any) =>
    client.get('/workflow/batches', { params }),
  getBatch:      (batchId: number) =>
    client.get(`/workflow/batches/${batchId}`),

  // 3. Transfer (TPA Gate)
  transferLookup:  (chassis: string) =>
    client.get('/workflow/transfer/lookup', { params: { chassis } }),
  driverLookup:    (id_card: string) =>
    client.get('/workflow/transfer/driver-lookup', { params: { id_card } }),
  transferConfirm: (data: { vehicle_id: number; driver_id?: number; driver_id_card?: string; notes?: string }) =>
    client.post('/workflow/transfer/confirm', data),

  // 4. Receive (Yard)
  receiveLookup:  (id_card: string) =>
    client.get('/workflow/receive/lookup', { params: { id_card } }),
  receiveConfirm: (driver_id: number, vehicle_id: number, notes?: string) =>
    client.post('/workflow/receive/confirm', { driver_id, vehicle_id, notes }),

  // 5. Search & history
  search:     (chassis: string) =>
    client.get('/workflow/search', { params: { chassis } }),
  getHistory: (vehicleId: number) =>
    client.get(`/workflow/vehicles/${vehicleId}/history`),

  // 6. Batch status management (migration 008 — backoffice_officer right)
  updateBatchStatus: (batchId: number, data: {
    document_status?: 'not_ready' | 'ready';
    document_remark?: string;
    gc_status?: 'not_sent' | 'sent';
    gc_remark?: string;
  }) =>
    client.patch(`/workflow/batches/${batchId}/status`, data),

  // 7. Batch print (chassis list — printBatches right)
  getBatchPrint: (batchId: number) =>
    client.get(`/workflow/batches/${batchId}/print`),

  // 8. TPA Stats (viewTpaStats right — transfer_officer + admin+)
  getTpaStats: () =>
    client.get('/workflow/transfer/tpa-stats'),

  // 9. Delivery Sheet
  getBatchDeliverySheet:    (batchId: number) =>
    client.get(`/workflow/batches/${batchId}/delivery-sheet`),
  getVesselDeliverySheet:   (vesselId: number) =>
    client.get(`/workflow/vessels/${vesselId}/delivery-sheet`),
  getManifestDeliverySheet: (manifestId: number) =>
    client.get(`/manifests/${manifestId}/delivery-sheet`),
};

// ── Lookups (extended) ────────────────────────────────────────────────────────
export const lookupsApi = {
  sectors:           ()                                    => client.get('/lookups/sectors'),
  regions:           ()                                    => client.get('/lookups/regions'),
  implementers:      ()                                    => client.get('/lookups/implementers'),
  createSector:      (data: any)                           => client.post('/lookups/sectors', data),
  updateSector:      (id: number, data: any)               => client.patch(`/lookups/sectors/${id}`, data),
  deleteSector:      (id: number)                          => client.delete(`/lookups/sectors/${id}`),
  createRegion:      (data: any)                           => client.post('/lookups/regions', data),
  updateRegion:      (id: number, data: any)               => client.patch(`/lookups/regions/${id}`, data),
  deleteRegion:      (id: number)                          => client.delete(`/lookups/regions/${id}`),
  createImplementer: (data: any)                           => client.post('/lookups/implementers', data),
  updateImplementer: (id: number, data: any)               => client.patch(`/lookups/implementers/${id}`, data),
  deleteImplementer: (id: number)                          => client.delete(`/lookups/implementers/${id}`),
};

// ── Projects ──────────────────────────────────────────────────────────────────
export const projectsApi = {
  list:   (params?: any)                   => client.get('/projects', { params }),
  get:    (id: number)                     => client.get(`/projects/${id}`),
  create: (data: any)                      => client.post('/projects', data),
  update: (id: number, data: any)          => client.patch(`/projects/${id}`, data),
};

export const objectivesApi = {
  listByProject: (projectId: number)       => client.get(`/projects/${projectId}/objectives`),
  create:        (data: any)               => client.post('/objectives', data),
};

export const targetsApi = {
  listByObjective: (objectiveId: number)   => client.get(`/objectives/${objectiveId}/targets`),
  create:          (data: any)             => client.post('/targets', data),
};

export const activitiesApi = {
  list:               (params?: any)               => client.get('/activities', { params }),
  get:                (id: number)                  => client.get(`/activities/${id}`),
  create:             (data: any)                   => client.post('/activities', data),
  update:             (id: number, data: any)       => client.patch(`/activities/${id}`, data),
  delete:             (id: number)                  => client.delete(`/activities/${id}`),
  getSubActivities:   (id: number)                  => client.get(`/activities/${id}/sub-activities`),
  getPayments:        (id: number)                  => client.get(`/activities/${id}/payments`),
  getPaymentSummary:  (id: number)                  => client.get(`/activities/${id}/payments/summary`),
  createPayment:      (id: number, data: any)       => client.post(`/activities/${id}/payments`, data),
  updatePaymentStatus:(activityId: number, paymentId: number, status: string) => client.patch(`/activities/${activityId}/payments/${paymentId}/status`, { status }),
  deletePayment:      (activityId: number, paymentId: number) => client.delete(`/activities/${activityId}/payments/${paymentId}`),
  getComments:        (id: number)                  => client.get(`/activities/${id}/comments`),
  addComment:         (id: number, data: any)       => client.post(`/activities/${id}/comments`, data),
  deleteComment:      (activityId: number, commentId: number) => client.delete(`/activities/${activityId}/comments/${commentId}`),
  getDocuments:       (id: number)                  => client.get(`/activities/${id}/documents`),
  uploadDocument:     (id: number, formData: FormData) => client.post(`/activities/${id}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getHistory:         (id: number)                  => client.get(`/activities/${id}/history`),
};

export const budgetApi = {
  projectSummary: (projectId: number)              => client.get(`/projects/${projectId}/budget/summary`),
  listRevisions:  (params?: any)                   => client.get('/budget/revisions', { params }),
  requestRevision:(activityIdOrData: number | any, amount?: number, reason?: string) => client.post('/budget/revisions', typeof activityIdOrData === 'number' ? { activity_id: activityIdOrData, amount, reason } : activityIdOrData),
  approveRevision:(id: number, data?: any)         => client.patch(`/budget/revisions/${id}/approve`, data),
  rejectRevision: (id: number, data?: any)         => client.patch(`/budget/revisions/${id}/reject`, data),
  allocateTarget: (targetId: number, data: any)    => client.post(`/targets/${targetId}/budget`, data),
};

export const documentsApi = {
  listByProject: (projectId: number)               => client.get(`/projects/${projectId}/documents`),
  upload:        (projectIdOrData: number | FormData, formData?: FormData) => {
    const fd = formData ?? projectIdOrData as FormData;
    const url = typeof projectIdOrData === 'number' ? `/projects/${projectIdOrData}/documents` : '/documents';
    return client.post(url, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// ── Inspection ────────────────────────────────────────────────────────────────
export const inspectionApi = {
  listRequests:     (params?: any)                  => client.get('/inspection/requests', { params }),
  getRequest:       (id: number)                    => client.get(`/inspection/requests/${id}`),
  createRequest:    (data: any)                     => client.post('/inspection/requests', data),
  updateRequest:    (id: number, data: any)         => client.patch(`/inspection/requests/${id}`, data),
  cancelRequest:    (id: number, data?: any)        => client.patch(`/inspection/requests/${id}/cancel`, data),
  acceptAssignment: (id: number, data?: any)        => client.patch(`/inspection/requests/${id}/accept`, data),
  rejectAssignment: (id: number, data?: any)        => client.patch(`/inspection/requests/${id}/reject`, data),
  getExecutionData: (id: number)                    => client.get(`/inspection/requests/${id}/execution`),
  saveResponses:    (id: number, data: any)         => client.post(`/inspection/requests/${id}/responses`, data),
  submitInspection: (id: number, data?: any)        => client.patch(`/inspection/requests/${id}/submit`, data),
  approveInspection:(id: number, data?: any)        => client.patch(`/inspection/requests/${id}/approve`, data),
  rejectApproval:   (id: number, data?: any)        => client.patch(`/inspection/requests/${id}/reject-approval`, data),
  getEvidence:      (id: number)                    => client.get(`/inspection/requests/${id}/evidence`),
  uploadEvidence:   (id: number, formData: FormData)=> client.post(`/inspection/requests/${id}/evidence`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  listChecklists:   (params?: any)                  => client.get('/inspection/checklists', { params }),
  getChecklist:     (id: number)                    => client.get(`/inspection/checklists/${id}`),
  createChecklist:  (data: any)                     => client.post('/inspection/checklists', data),
  updateChecklist:  (id: number, data: any)         => client.patch(`/inspection/checklists/${id}`, data),
  deleteChecklist:  (id: number)                    => client.delete(`/inspection/checklists/${id}`),
  getStoreStock:    (storeId: number)               => client.get(`/inventory/stores/${storeId}/stock`),
  getStockTransactions: (params?: any)              => client.get('/inventory/stock-transactions', { params }),
};

// ── Stores ────────────────────────────────────────────────────────────────────
export const storesApi = {
  list:   (params?: any)          => client.get('/inventory/stores', { params }),
  create: (data: any)             => client.post('/inventory/stores', data),
  update: (id: number, data: any) => client.patch(`/inventory/stores/${id}`, data),
  delete: (id: number)            => client.delete(`/inventory/stores/${id}`),
};

// ── Suppliers ─────────────────────────────────────────────────────────────────
export const suppliersApi = {
  list:   (params?: any)          => client.get('/inventory/suppliers', { params }),
  create: (data: any)             => client.post('/inventory/suppliers', data),
  update: (id: number, data: any) => client.patch(`/inventory/suppliers/${id}`, data),
  delete: (id: number)            => client.delete(`/inventory/suppliers/${id}`),
};

// ── Products ──────────────────────────────────────────────────────────────────
export const productsApi = {
  list:         (params?: any)          => client.get('/inventory/products', { params }),
  create:       (data: any)             => client.post('/inventory/products', data),
  update:       (id: number, data: any) => client.patch(`/inventory/products/${id}`, data),
  delete:       (id: number)            => client.delete(`/inventory/products/${id}`),
  getCategories:()                      => client.get('/inventory/product-categories'),
};

// ── Purchase Orders ───────────────────────────────────────────────────────────
export const purchaseOrdersApi = {
  list:   (params?: any)          => client.get('/inventory/purchase-orders', { params }),
  get:    (id: number)            => client.get(`/inventory/purchase-orders/${id}`),
  create: (data: any)             => client.post('/inventory/purchase-orders', data),
  update: (id: number, data: any) => client.patch(`/inventory/purchase-orders/${id}`, data),
  cancel: (id: number, data?: any)=> client.patch(`/inventory/purchase-orders/${id}/cancel`, data),
};

// ── Transfers (Inventory) ─────────────────────────────────────────────────────
export const transfersApi = {
  list:          (params?: any)          => client.get('/inventory/transfers', { params }),
  get:           (id: number)            => client.get(`/inventory/transfers/${id}`),
  create:        (data: any)             => client.post('/inventory/transfers', data),
  update:        (id: number, data: any) => client.patch(`/inventory/transfers/${id}`, data),
  approve:       (id: number, data?: any)=> client.patch(`/inventory/transfers/${id}/approve`, data),
  dispatch:      (id: number, data?: any)=> client.patch(`/inventory/transfers/${id}/dispatch`, data),
  receive:       (id: number, data?: any)=> client.patch(`/inventory/transfers/${id}/receive`, data),
  cancel:        (id: number, data?: any)=> client.patch(`/inventory/transfers/${id}/cancel`, data),
  getStoreStock: (storeId: number)       => client.get(`/inventory/stores/${storeId}/stock`),
};

// ── Logistics ─────────────────────────────────────────────────────────────────
export const logisticsApi = {
  listCompanies:    (params?: any)          => client.get('/logistics/companies', { params }),
  createCompany:    (data: any)             => client.post('/logistics/companies', data),
  updateCompany:    (id: number, data: any) => client.patch(`/logistics/companies/${id}`, data),
  deleteCompany:    (id: number)            => client.delete(`/logistics/companies/${id}`),
  listTransactions: (params?: any)          => client.get('/logistics/transactions', { params }),
  getTransaction:   (id: number)            => client.get(`/logistics/transactions/${id}`),
  createTransaction:(data: any)             => client.post('/logistics/transactions', data),
  updateTransaction:(id: number, data: any) => client.patch(`/logistics/transactions/${id}`, data),
  schedulePickup:   (id: number, data?: any)=> client.patch(`/logistics/transactions/${id}/schedule-pickup`, data),
  markPickedUp:     (id: number, data?: any)=> client.patch(`/logistics/transactions/${id}/picked-up`, data),
  markInTransit:    (id: number, data?: any)=> client.patch(`/logistics/transactions/${id}/in-transit`, data),
  markArrived:      (id: number, data?: any)=> client.patch(`/logistics/transactions/${id}/arrived`, data),
  markDelivered:    (id: number, data?: any)=> client.patch(`/logistics/transactions/${id}/delivered`, data),
  markDelayed:      (id: number, data?: any)=> client.patch(`/logistics/transactions/${id}/delayed`, data),
  cancelShipment:   (id: number, data?: any)=> client.patch(`/logistics/transactions/${id}/cancel`, data),
  addNote:          (id: number, noteOrData: any, location?: string) => client.post(`/logistics/transactions/${id}/notes`, typeof noteOrData === 'string' ? { note: noteOrData, location } : noteOrData),
};

// ── Financial ─────────────────────────────────────────────────────────────────
export const financialApi = {
  summary:         (params?: any) => client.get('/financial/summary', { params }),
  list:            (params?: any) => client.get('/financial', { params }),
  get:             (id: number)   => client.get(`/financial/${id}`),
  create:          (data: any)    => client.post('/financial', data),
  update:          (id: number, data: any) => client.patch(`/financial/${id}`, data),
  delete:          (id: number)   => client.delete(`/financial/${id}`),
};
