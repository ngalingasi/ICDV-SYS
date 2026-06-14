import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';
import '../models/models.dart';

// ─── Error extraction helper ──────────────────────────────────────────────────
/// Extracts the actual backend error message from a Dio exception.
/// Falls back to a user-friendly generic message based on status code.
String extractApiError(
  Object e, {
  String fallback = 'Operation failed. Please try again.',
}) {
  if (e is DioException) {
    final data = e.response?.data;
    if (data is Map<String, dynamic>) {
      final msg = data['message'] as String?;
      if (msg != null && msg.isNotEmpty) return msg;
    }
    final statusCode = e.response?.statusCode;
    return switch (statusCode) {
      401 => 'Unauthorized. Please log in again.',
      403 => 'You do not have permission to perform this operation.',
      404 => 'Record not found.',
      409 => 'Conflict — vehicle may already be in this state.',
      422 => 'Validation error. Check the data and try again.',
      500 => 'Server error. Please try again later.',
      _ =>
        e.type == DioExceptionType.connectionTimeout ||
                e.type == DioExceptionType.receiveTimeout
            ? 'Connection timed out. Check your internet connection.'
            : e.type == DioExceptionType.connectionError
            ? 'Cannot connect to server. Check your internet connection.'
            : fallback,
    };
  }
  return fallback;
}

class WorkflowApi {
  final Ref _ref;
  WorkflowApi(this._ref);

  // ── 1. Discharge ────────────────────────────────────────────────────────────
  Future<Vehicle> dischargeLookup(String chassis) async {
    final res = await _ref
        .read(dioProvider)
        .getJson('/workflow/discharge/lookup', params: {'chassis': chassis});
    return Vehicle.fromJson(res);
  }

  Future<void> dischargeConfirm(int vehicleId, {String? notes}) async {
    await _ref
        .read(dioProvider)
        .postJson(
          '/workflow/discharge/confirm',
          data: {'vehicle_id': vehicleId, if (notes != null) 'notes': notes},
        );
  }

  // ── 2. Batch ────────────────────────────────────────────────────────────────
  Future<Vehicle> batchLookup(String chassis) async {
    final res = await _ref
        .read(dioProvider)
        .getJson('/workflow/batch/lookup', params: {'chassis': chassis});
    return Vehicle.fromJson(res);
  }

  Future<Map<String, dynamic>> batchConfirm(
    int vehicleId, {
    String? notes,
  }) async {
    return _ref
        .read(dioProvider)
        .postJson(
          '/workflow/batch/confirm',
          data: {'vehicle_id': vehicleId, if (notes != null) 'notes': notes},
        );
  }

  // ── 2b. Batch list (for backoffice_officer) ─────────────────────────────────
  Future<List<BatchStatusInfo>> getBatches({
    int page = 1,
    int limit = 20,
    String? status,
    String? manifestId,
  }) async {
    final res = await _ref
        .read(dioProvider)
        .getJson(
          '/workflow/batches',
          params: {
            'page': page,
            'limit': limit,
            if (status != null) 'status': status,
            if (manifestId != null) 'manifest_id': manifestId,
          },
        );
    final list = (res['results'] as List? ?? []);
    return list
        .map((e) => BatchStatusInfo.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ── 2c. Batch status update (backoffice_officer) ────────────────────────────
  Future<BatchStatusInfo> updateBatchStatus(
    int batchId, {
    String? documentStatus,
    String? documentRemark,
    String? gcStatus,
    String? gcRemark,
  }) async {
    final res = await _ref
        .read(dioProvider)
        .postJson(
          '/workflow/batches/$batchId/status',
          data: {
            if (documentStatus != null) 'document_status': documentStatus,
            if (documentRemark != null) 'document_remark': documentRemark,
            if (gcStatus != null) 'gc_status': gcStatus,
            if (gcRemark != null) 'gc_remark': gcRemark,
          },
        );
    return BatchStatusInfo.fromJson(res);
  }

  // ── 2d. Get single batch detail ─────────────────────────────────────────────
  Future<BatchStatusInfo> getBatch(int batchId) async {
    final res = await _ref
        .read(dioProvider)
        .getJson('/workflow/batches/$batchId');
    return BatchStatusInfo.fromJson(res);
  }

  // ── 3. Transfer ─────────────────────────────────────────────────────────────
  Future<Vehicle> transferLookup(String chassis) async {
    final res = await _ref
        .read(dioProvider)
        .getJson('/workflow/transfer/lookup', params: {'chassis': chassis});
    return Vehicle.fromJson(res);
  }

  Future<Driver> driverLookup(String idCard) async {
    final res = await _ref
        .read(dioProvider)
        .getJson(
          '/workflow/transfer/driver-lookup',
          params: {'id_card': idCard},
        );
    return Driver.fromJson(res);
  }

  Future<void> transferConfirm({
    required int vehicleId,
    required int driverId,
    required String driverIdCard,
    String? notes,
  }) async {
    await _ref
        .read(dioProvider)
        .postJson(
          '/workflow/transfer/confirm',
          data: {
            'vehicle_id': vehicleId,
            'driver_id': driverId,
            'driver_id_card': driverIdCard,
            if (notes != null) 'notes': notes,
          },
        );
  }

  // ── 4. Receive ──────────────────────────────────────────────────────────────
  Future<ReceiveLookup> receiveLookup(String idCard) async {
    final res = await _ref
        .read(dioProvider)
        .getJson('/workflow/receive/lookup', params: {'id_card': idCard});
    return ReceiveLookup.fromJson(res);
  }

  Future<void> receiveConfirm(
    int driverId,
    int vehicleId, {
    String? notes,
  }) async {
    await _ref
        .read(dioProvider)
        .postJson(
          '/workflow/receive/confirm',
          data: {
            'driver_id': driverId,
            'vehicle_id': vehicleId,
            if (notes != null) 'notes': notes,
          },
        );
  }

  // ── 5. Chassis search ───────────────────────────────────────────────────────
  Future<List<Vehicle>> search(String chassis) async {
    final resp = await _ref
        .read(dioProvider)
        .get('/workflow/search', queryParameters: {'chassis': chassis});
    final data = resp.data;
    List<dynamic> list;
    if (data is List) {
      list = data;
    } else if (data is Map && data['data'] is List) {
      list = data['data'] as List;
    } else if (data is Map && data['results'] is List) {
      list = data['results'] as List;
    } else {
      list = [];
    }
    return list
        .map((e) => Vehicle.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ── 6. Vehicle operation history ────────────────────────────────────────────
  Future<List<OperationHistory>> getVehicleHistory(int vehicleId) async {
    try {
      final res = await _ref
          .read(dioProvider)
          .get('/workflow/vehicles/$vehicleId/history');
      final data = res.data;
      final list =
          data is List
              ? data
              : (data['data'] as List? ?? data['operations'] as List? ?? []);
      return list
          .map((e) => OperationHistory.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<List<OperationHistory>> getVehicleOperations(int vehicleId) async {
    try {
      final res = await _ref
          .read(dioProvider)
          .get('/vehicles/$vehicleId/operations');
      final data = res.data;
      final list =
          data is List
              ? data
              : (data['data'] as List? ?? data['operations'] as List? ?? []);
      return list
          .map((e) => OperationHistory.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  // ── 10. Vehicles list (for workflow status drill-down) ──────────────────────
  Future<Map<String, dynamic>> getVehicles({
    String? workflowStatus,
    int? manifestId,
    int page = 1,
    int limit = 30,
  }) async {
    final res = await _ref
        .read(dioProvider)
        .getJson(
          '/vehicles',
          params: {
            'page': page,
            'limit': limit,
            if (workflowStatus != null) 'workflow_status': workflowStatus,
            if (manifestId != null) 'manifest_id': manifestId,
          },
        );
    return res as Map<String, dynamic>;
  }

  Future<List<ManifestSummary>> getManifests({
    int page = 1,
    int limit = 30,
  }) async {
    try {
      final res = await _ref
          .read(dioProvider)
          .getJson(
            '/manifests',
            params: {'page': page, 'limit': limit, 'status': 'active'},
          );
      final list = (res['results'] as List? ?? []);
      return list
          .map((e) => ManifestSummary.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  // ── 8. Dashboard (global + manifest-scoped) ─────────────────────────────────
  Future<Map<String, dynamic>> getDashboard() =>
      _ref.read(dioProvider).getJson('/dashboard');

  Future<Map<String, dynamic>> getManifestDashboard(int manifestId) =>
      _ref.read(dioProvider).getJson('/dashboard/manifest/$manifestId');

  // ── 9. Fuel ─────────────────────────────────────────────────────────────────

  /// GET /manifests/:id/fuel/dashboard
  Future<Map<String, dynamic>> getFuelDashboard(int manifestId) =>
      _ref.read(dioProvider).getJson('/manifests/$manifestId/fuel/dashboard');

  /// GET /manifests/:id/fuel/orders
  Future<List<FuelOrder>> getFuelOrders(int manifestId) async {
    final res = await _ref
        .read(dioProvider)
        .getJson('/manifests/$manifestId/fuel/orders');
    final list = (res['results'] as List? ?? res as List? ?? []);
    return (list)
        .map((e) => FuelOrder.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// POST /manifests/:id/fuel/orders — create order
  Future<FuelOrder> createFuelOrder(
    int manifestId, {
    required String fuelType,
    required double quantityLitres,
    String? notes,
  }) async {
    final res = await _ref
        .read(dioProvider)
        .postJson(
          '/manifests/$manifestId/fuel/orders',
          data: {
            'fuel_type': fuelType,
            'quantity_litres': quantityLitres,
            if (notes != null) 'notes': notes,
          },
        );
    return FuelOrder.fromJson(res);
  }

  /// PATCH /manifests/:id/fuel/orders/:orderId/approve
  Future<void> approveFuelOrder(int manifestId, int orderId) => _ref
      .read(dioProvider)
      .postJson(
        '/manifests/$manifestId/fuel/orders/$orderId/approve',
        data: {},
      );

  /// PATCH /manifests/:id/fuel/orders/:orderId/reject
  Future<void> rejectFuelOrder(int manifestId, int orderId, {String? reason}) =>
      _ref
          .read(dioProvider)
          .postJson(
            '/manifests/$manifestId/fuel/orders/$orderId/reject',
            data: {if (reason != null) 'reason': reason},
          );

  /// GET /fuel/lookup?chassis=X — find vehicle for dispense
  Future<Vehicle> fuelVehicleLookup(String chassis) async {
    final res = await _ref
        .read(dioProvider)
        .getJson('/fuel/lookup', params: {'chassis': chassis});
    return Vehicle.fromJson(res);
  }

  /// POST /fuel/dispense
  Future<void> dispenseFuel({
    required int vehicleId,
    required double quantityLitres,
    required int manifestId,
    String? notes,
  }) => _ref
      .read(dioProvider)
      .postJson(
        '/fuel/dispense',
        data: {
          'vehicle_id': vehicleId,
          'quantity_litres': quantityLitres,
          'manifest_id': manifestId,
          if (notes != null) 'notes': notes,
        },
      );
}

final workflowApiProvider = Provider<WorkflowApi>(WorkflowApi.new);
