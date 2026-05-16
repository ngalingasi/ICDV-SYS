// ─────────────────────────────────────────────────────────────────────────────
// ICDV Mobile — Data Models
// ─────────────────────────────────────────────────────────────────────────────

class User {
  final int    userId;
  final String username;
  final String fullName;
  final String role;
  final int?   icdvId;
  final String? icdvName;

  const User({
    required this.userId,
    required this.username,
    required this.fullName,
    required this.role,
    this.icdvId,
    this.icdvName,
  });

  bool get isSuperAdmin  => role == 'super_admin';
  bool get isSystemAdmin => role == 'system_admin';
  bool get isCrossTenant => isSuperAdmin || isSystemAdmin;

  factory User.fromJson(Map<String, dynamic> j) => User(
    userId:   j['user_id']  as int,
    username: j['username'] as String,
    fullName: j['full_name'] ?? j['username'] ?? '',
    role:     j['role']     as String,
    icdvId:   j['icdv_id']  as int?,
    icdvName: j['icdv_name'] as String?,
  );
}

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
  final String? vesselName;
  final String? batchNumber;
  final String? icdvName;
  final String? icdvCode;
  final int     icdvId;

  const Vehicle({
    required this.vehicleId,
    required this.chassisNumber,
    this.brand,
    this.model,
    this.color,
    this.year,
    this.customerName,
    this.destination,
    required this.workflowStatus,
    required this.currentLocation,
    required this.releaseStatus,
    this.manifestNumber,
    this.vesselName,
    this.batchNumber,
    this.icdvName,
    this.icdvCode,
    required this.icdvId,
  });

  String get vehicleTitle => [brand, model, year?.toString(), color]
      .where((e) => e != null && e.isNotEmpty).join(' · ');

  factory Vehicle.fromJson(Map<String, dynamic> j) => Vehicle(
    vehicleId:      j['vehicle_id']      as int,
    chassisNumber:  j['chassis_number']  as String,
    brand:          j['brand']           as String?,
    model:          j['model']           as String?,
    color:          j['color']           as String?,
    year:           j['year']            as int?,
    customerName:   j['customer_name']   as String?,
    destination:    j['destination']     as String?,
    workflowStatus: j['workflow_status'] ?? 'unknown',
    currentLocation:j['current_location'] ?? '',
    releaseStatus:  j['release_status']  ?? 'unknown',
    manifestNumber: j['manifest_number'] as String?,
    vesselName:     j['vessel_name']     as String?,
    batchNumber:    j['batch_number']    as String?,
    icdvName:       j['icdv_name']       as String?,
    icdvCode:       j['icdv_code']       as String?,
    icdvId:         j['icdv_id']         as int? ?? 0,
  );
}

class Driver {
  final int    driverId;
  final String fullName;
  final String licenseNumber;
  final String? idNumber;
  final String? phone;
  final String  status;
  final String? photo;

  const Driver({
    required this.driverId,
    required this.fullName,
    required this.licenseNumber,
    this.idNumber,
    this.phone,
    required this.status,
    this.photo,
  });

  factory Driver.fromJson(Map<String, dynamic> j) => Driver(
    driverId:      j['driver_id']      as int,
    fullName:      j['full_name']      as String,
    licenseNumber: j['license_number'] as String,
    idNumber:      j['id_number']      as String?,
    phone:         j['phone']          as String?,
    status:        j['status']         as String? ?? 'active',
    photo:         j['photo']          as String?,
  );
}

class ReceiveLookup {
  final Driver  driver;
  final Vehicle vehicle;
  final int?    transferId;
  final String? transferredAt;

  const ReceiveLookup({
    required this.driver,
    required this.vehicle,
    this.transferId,
    this.transferredAt,
  });

  factory ReceiveLookup.fromJson(Map<String, dynamic> j) {
    final assignment = j['assignment'] as Map<String, dynamic>;
    return ReceiveLookup(
      driver:        Driver.fromJson(j['driver'] as Map<String, dynamic>),
      vehicle:       Vehicle.fromJson(assignment),
      transferId:    assignment['transfer_id'] as int?,
      transferredAt: assignment['transferred_at'] as String?,
    );
  }
}

class OperationHistory {
  final int    opId;
  final String operationType;
  final String? fromStatus;
  final String? toStatus;
  final String? fromLocation;
  final String? toLocation;
  final String? notes;
  final String? operatorName;
  final String  performedAt;

  const OperationHistory({
    required this.opId,
    required this.operationType,
    this.fromStatus,
    this.toStatus,
    this.fromLocation,
    this.toLocation,
    this.notes,
    this.operatorName,
    required this.performedAt,
  });

  factory OperationHistory.fromJson(Map<String, dynamic> j) => OperationHistory(
    opId:          j['op_id']          as int,
    operationType: j['operation_type'] as String,
    fromStatus:    j['from_status']    as String?,
    toStatus:      j['to_status']      as String?,
    fromLocation:  j['from_location']  as String?,
    toLocation:    j['to_location']    as String?,
    notes:         j['notes']          as String?,
    operatorName:  j['operator_name']  as String?,
    performedAt:   j['performed_at']   as String,
  );
}
