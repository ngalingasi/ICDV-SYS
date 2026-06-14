// ─────────────────────────────────────────────────────────────────────────────
// USER
// ─────────────────────────────────────────────────────────────────────────────

class User {
  final int     userId;
  final String  username;
  final String  fullName;
  final String  role;
  final int?    icdvId;
  final String? icdvName;
  final bool    mustChangePassword;

  const User({
    required this.userId,
    required this.username,
    required this.fullName,
    required this.role,
    this.icdvId,
    this.icdvName,
    this.mustChangePassword = false,
  });

  // ── Existing roles ──────────────────────────────────────────────────────────
  bool get isSuperAdmin  => role == 'super_admin';
  bool get isSystemAdmin => role == 'system_admin';
  bool get isAdmin       => role == 'admin';
  bool get isSupervisor  => role == 'supervisor';
  bool get isOperator    => role == 'operator';

  // ── New operational roles (migration 008) ───────────────────────────────────
  bool get isDischargeOfficer  => role == 'discharge_officer';
  bool get isBackofficeOfficer => role == 'backoffice_officer';
  bool get isTransferOfficer   => role == 'transfer_officer';
  bool get isYardOfficer       => role == 'yard_officer';

  // ── Fuel role (migration 011) ───────────────────────────────────────────────
  bool get isFuelOfficer => role == 'fuel_officer';

  // ── Permission helpers (mirrors web roles.js) ───────────────────────────────

  /// Admin/super_admin/system_admin bypass all restrictions
  bool get isAdminLevel =>
      isSuperAdmin || isSystemAdmin || isAdmin;

  /// Can perform discharge + batch operations
  bool get canDischarge =>
      isDischargeOfficer || isOperator || isSupervisor || isAdminLevel;

  /// Can perform TPA gate transfer
  bool get canTransfer =>
      isTransferOfficer || isOperator || isSupervisor || isAdminLevel;

  /// Can receive vehicles at yard
  bool get canReceive =>
      isYardOfficer || isOperator || isSupervisor || isAdminLevel;

  /// Can update batch document_status / gc_status
  bool get canUpdateBatchStatus =>
      isBackofficeOfficer || isOperator || isSupervisor || isAdminLevel;

  /// Can print delivery sheets
  bool get canPrintDeliverySheet =>
      isBackofficeOfficer || isYardOfficer ||
      isOperator || isSupervisor || isAdminLevel;

  /// Can view TPA stats
  bool get canViewTpaStats =>
      isTransferOfficer || isOperator || isSupervisor || isAdminLevel;

  /// Fuel operations
  bool get canManageFuel =>
      isFuelOfficer || isOperator || isSupervisor || isAdminLevel;

  /// Can approve/reject fuel orders (supervisor+ only)
  bool get canApproveFuel =>
      isSupervisor || isAdminLevel;

  /// Can access chassis search
  bool get canSearch => true; // all roles

  factory User.fromJson(Map<String, dynamic> j) => User(
    userId:             j['user_id']              as int,
    username:           j['username']             as String,
    fullName:           j['full_name']            as String? ?? j['username'] as String? ?? '',
    role:               j['role']                 as String,
    icdvId:             j['icdv_id']              as int?,
    icdvName:           j['icdv_name']            as String?,
    mustChangePassword: (j['must_change_password'] == true || j['must_change_password'] == 1),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH TOKENS
// ─────────────────────────────────────────────────────────────────────────────

class AuthTokens {
  final String access;
  final String refresh;
  const AuthTokens({required this.access, required this.refresh});

  factory AuthTokens.fromJson(Map<String, dynamic> j) {
    final t = j['tokens'] as Map<String, dynamic>? ?? j;
    return AuthTokens(
      access:  (t['access']  as Map)['token'] as String,
      refresh: (t['refresh'] as Map)['token'] as String,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VEHICLE
// ─────────────────────────────────────────────────────────────────────────────

class Vehicle {
  final int     vehicleId;
  final String  chassisNumber;
  final String? brand;
  final String? model;
  final String? color;
  final int?    year;
  final String? customerName;
  final String? destination;
  final String  workflowStatus;
  final String  currentLocation;
  final String  releaseStatus;
  final String? manifestNumber;
  final int?    manifestId;
  final String? vesselName;
  final String? batchNumber;
  final int?    batchId;
  final String? icdvName;
  final String? icdvCode;
  final int     icdvId;

  const Vehicle({
    required this.vehicleId,
    required this.chassisNumber,
    this.brand, this.model, this.color, this.year,
    this.customerName, this.destination,
    required this.workflowStatus,
    required this.currentLocation,
    required this.releaseStatus,
    this.manifestNumber, this.manifestId,
    this.vesselName, this.batchNumber, this.batchId,
    this.icdvName, this.icdvCode,
    required this.icdvId,
  });

  String get vehicleTitle => [brand, model, year?.toString(), color]
      .where((e) => e != null && e.isNotEmpty).join(' · ');

  factory Vehicle.fromJson(Map<String, dynamic> j) => Vehicle(
    vehicleId:       j['vehicle_id']       as int,
    chassisNumber:   j['chassis_number']   as String,
    brand:           j['brand']            as String?,
    model:           j['model']            as String?,
    color:           j['color']            as String?,
    year:            j['year']             as int?,
    customerName:    j['customer_name']    as String?,
    destination:     j['destination']      as String?,
    workflowStatus:  j['workflow_status']  as String? ?? 'unknown',
    currentLocation: j['current_location'] as String? ?? '',
    releaseStatus:   j['release_status']   as String? ?? 'unknown',
    manifestNumber:  j['manifest_number']  as String?,
    manifestId:      j['manifest_id']      as int?,
    vesselName:      j['vessel_name']      as String?,
    batchNumber:     j['batch_number']     as String?,
    batchId:         j['batch_id']         as int?,
    icdvName:        j['icdv_name']        as String?,
    icdvCode:        j['icdv_code']        as String?,
    icdvId:          j['icdv_id']          as int? ?? 0,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER
// ─────────────────────────────────────────────────────────────────────────────

class Driver {
  final int    driverId;
  final String fullName;
  final String licenseNumber;
  final String? idNumber;
  final String? phone;
  final String  status;

  const Driver({
    required this.driverId,
    required this.fullName,
    required this.licenseNumber,
    this.idNumber, this.phone,
    required this.status,
  });

  factory Driver.fromJson(Map<String, dynamic> j) => Driver(
    driverId:      j['driver_id']      as int,
    fullName:      j['full_name']      as String,
    licenseNumber: j['license_number'] as String,
    idNumber:      j['id_number']      as String?,
    phone:         j['phone']          as String?,
    status:        j['status']         as String? ?? 'active',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEIVE LOOKUP
// ─────────────────────────────────────────────────────────────────────────────

class ReceiveLookup {
  final Driver  driver;
  final Vehicle vehicle;
  final int?    transferId;
  final String? transferredAt;

  const ReceiveLookup({required this.driver, required this.vehicle,
      this.transferId, this.transferredAt});

  factory ReceiveLookup.fromJson(Map<String, dynamic> j) {
    final assignment = j['assignment'] as Map<String, dynamic>;
    return ReceiveLookup(
      driver:        Driver.fromJson(j['driver'] as Map<String, dynamic>),
      vehicle:       Vehicle.fromJson(assignment),
      transferId:    assignment['transfer_id']    as int?,
      transferredAt: assignment['transferred_at'] as String?,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATION HISTORY
// ─────────────────────────────────────────────────────────────────────────────

class OperationHistory {
  final int    opId;
  final String operationType;
  final String? fromStatus, toStatus, fromLocation, toLocation, notes, operatorName;
  final String  performedAt;

  const OperationHistory({
    required this.opId, required this.operationType,
    this.fromStatus, this.toStatus, this.fromLocation,
    this.toLocation, this.notes, this.operatorName,
    required this.performedAt,
  });

  factory OperationHistory.fromJson(Map<String, dynamic> j) => OperationHistory(
    opId:          (j['op_id'] ?? j['id'] ?? 0) as int,
    operationType: (j['operation_type'] as String? ?? '')
        .replaceAll('transferred', 'transfer'),
    fromStatus:    j['from_status']    as String?,
    toStatus:      j['to_status']      as String?,
    fromLocation:  j['from_location']  as String?,
    toLocation:    j['to_location']    as String?,
    notes:         j['notes']          as String?,
    operatorName:  j['operator_name']  as String?,
    performedAt:   (j['performed_at'] ?? j['created_at'] ?? '') as String,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MANIFEST (for dashboard dropdown)
// ─────────────────────────────────────────────────────────────────────────────

class ManifestSummary {
  final int    manifestId;
  final String manifestNumber;
  final String arrivalDate;
  final String status;
  final String? vesselName;
  final int    totalVehicles;

  const ManifestSummary({
    required this.manifestId,
    required this.manifestNumber,
    required this.arrivalDate,
    required this.status,
    this.vesselName,
    this.totalVehicles = 0,
  });

  factory ManifestSummary.fromJson(Map<String, dynamic> j) => ManifestSummary(
    manifestId:     j['manifest_id']     as int,
    manifestNumber: j['manifest_number'] as String,
    arrivalDate:    j['arrival_date']    as String? ?? '',
    status:         j['status']          as String? ?? 'pending',
    vesselName:     j['vessel_name']     as String?,
    totalVehicles:  (j['total_vehicles'] as num?)?.toInt() ?? 0,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FUEL ORDER
// ─────────────────────────────────────────────────────────────────────────────

class FuelOrder {
  final int    orderId;
  final int    manifestId;
  final String fuelType;
  final double quantityLitres;
  final String status;
  final String? notes;
  final String? approvedBy;
  final String  createdAt;
  final String? approvedAt;

  const FuelOrder({
    required this.orderId,
    required this.manifestId,
    required this.fuelType,
    required this.quantityLitres,
    required this.status,
    this.notes,
    this.approvedBy,
    required this.createdAt,
    this.approvedAt,
  });

  factory FuelOrder.fromJson(Map<String, dynamic> j) => FuelOrder(
    orderId:        j['order_id']        as int,
    manifestId:     j['manifest_id']     as int,
    fuelType:       j['fuel_type']       as String? ?? 'diesel',
    quantityLitres: (j['quantity_litres'] as num?)?.toDouble() ?? 0,
    status:         j['status']          as String? ?? 'pending',
    notes:          j['notes']           as String?,
    approvedBy:     j['approved_by_name'] as String?,
    createdAt:      j['created_at']      as String? ?? '',
    approvedAt:     j['approved_at']     as String?,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH STATUS SUMMARY (for backoffice_officer doc/gc update)
// ─────────────────────────────────────────────────────────────────────────────

class BatchStatusInfo {
  final int    batchId;
  final String batchNumber;
  final String documentStatus;    // 'not_ready' | 'ready'
  final String? documentRemark;
  final String gcStatus;          // 'not_sent' | 'sent'
  final String? gcRemark;
  final String operationalStatus; // 'not_ready' | 'ready'
  final int    vehicleCount;
  final String status;            // batch lifecycle status
  final String? vesselName;
  final String? documentUpdatedByName;
  final String? gcUpdatedByName;

  const BatchStatusInfo({
    required this.batchId,
    required this.batchNumber,
    required this.documentStatus,
    this.documentRemark,
    required this.gcStatus,
    this.gcRemark,
    required this.operationalStatus,
    required this.vehicleCount,
    required this.status,
    this.vesselName,
    this.documentUpdatedByName,
    this.gcUpdatedByName,
  });

  factory BatchStatusInfo.fromJson(Map<String, dynamic> j) => BatchStatusInfo(
    batchId:               j['batch_id']                as int,
    batchNumber:           j['batch_number']            as String,
    documentStatus:        j['document_status']         as String? ?? 'not_ready',
    documentRemark:        j['document_remark']         as String?,
    gcStatus:              j['gc_status']               as String? ?? 'not_sent',
    gcRemark:              j['gc_remark']               as String?,
    operationalStatus:     j['operational_status']      as String? ?? 'not_ready',
    vehicleCount:          (j['vehicle_count'] as num?)?.toInt() ?? 0,
    status:                j['status']                  as String? ?? 'open',
    vesselName:            j['vessel_name']             as String?,
    documentUpdatedByName: j['document_updated_by_name'] as String?,
    gcUpdatedByName:       j['gc_updated_by_name']      as String?,
  );
}
