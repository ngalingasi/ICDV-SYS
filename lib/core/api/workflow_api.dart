import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';
import '../models/models.dart';

class WorkflowApi {
  final Ref _ref;
  WorkflowApi(this._ref);

  // ── 1. Discharge ────────────────────────────────────────────────────────────
  Future<Vehicle> dischargeLookup(String chassis) async {
    final res = await _ref.read(dioProvider).getJson(
      '/workflow/discharge/lookup', params: {'chassis': chassis});
    return Vehicle.fromJson(res);
  }

  Future<void> dischargeConfirm(int vehicleId, {String? notes}) async {
    await _ref.read(dioProvider).postJson(
      '/workflow/discharge/confirm',
      data: {'vehicle_id': vehicleId, if (notes != null) 'notes': notes},
    );
  }

  // ── 2. Batch ────────────────────────────────────────────────────────────────
  Future<Vehicle> batchLookup(String chassis) async {
    final res = await _ref.read(dioProvider).getJson(
      '/workflow/batch/lookup', params: {'chassis': chassis});
    return Vehicle.fromJson(res);
  }

  Future<Map<String, dynamic>> batchConfirm(int vehicleId, {String? notes}) async {
    return _ref.read(dioProvider).postJson(
      '/workflow/batch/confirm',
      data: {'vehicle_id': vehicleId, if (notes != null) 'notes': notes},
    );
  }

  // ── 3. Transfer ─────────────────────────────────────────────────────────────
  Future<Vehicle> transferLookup(String chassis) async {
    final res = await _ref.read(dioProvider).getJson(
      '/workflow/transfer/lookup', params: {'chassis': chassis});
    return Vehicle.fromJson(res);
  }

  Future<Driver> driverLookup(String idCard) async {
    final res = await _ref.read(dioProvider).getJson(
      '/workflow/transfer/driver-lookup', params: {'id_card': idCard});
    return Driver.fromJson(res);
  }

  Future<void> transferConfirm({
    required int vehicleId,
    required int driverId,
    required String driverIdCard,
    String? notes,
  }) async {
    await _ref.read(dioProvider).postJson(
      '/workflow/transfer/confirm',
      data: {
        'vehicle_id':     vehicleId,
        'driver_id':      driverId,
        'driver_id_card': driverIdCard,
        if (notes != null) 'notes': notes,
      },
    );
  }

  // ── 4. Receive ──────────────────────────────────────────────────────────────
  Future<ReceiveLookup> receiveLookup(String idCard) async {
    final res = await _ref.read(dioProvider).getJson(
      '/workflow/receive/lookup', params: {'id_card': idCard});
    return ReceiveLookup.fromJson(res);
  }

  Future<void> receiveConfirm(int driverId, int vehicleId, {String? notes}) async {
    await _ref.read(dioProvider).postJson(
      '/workflow/receive/confirm',
      data: {
        'driver_id':  driverId,
        'vehicle_id': vehicleId,
        if (notes != null) 'notes': notes,
      },
    );
  }

  // ── 5. Chassis search ───────────────────────────────────────────────────────
  Future<List<Vehicle>> search(String chassis) async {
    final res = await _ref.read(dioProvider).getJson(
      '/workflow/search', params: {'chassis': chassis});
    final list = res['data'] as List? ?? (res is List ? res : [res]);
    return list.map((e) => Vehicle.fromJson(e as Map<String, dynamic>)).toList();
  }

  // ── 6. Vehicle operation history ────────────────────────────────────────────
  Future<List<OperationHistory>> getVehicleHistory(int vehicleId) async {
    final res = await _ref.read(dioProvider)
        .get('/workflow/vehicles/$vehicleId/history');
    final data = res.data;
    final list = data is List ? data : (data['data'] as List? ?? []);
    return list.map((e) => OperationHistory.fromJson(e as Map<String, dynamic>)).toList();
  }
}

final workflowApiProvider = Provider<WorkflowApi>(WorkflowApi.new);
