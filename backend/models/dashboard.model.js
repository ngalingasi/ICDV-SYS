const { query } = require('../config/database');

// Actual schema (from icdv_deliver.sql):
// vessels:   vessel_id, icdv_id, name, imo_number, vessel_type, country_of_origin, status, notes, created_at
// manifests: manifest_id, icdv_id, vessel_id, manifest_number, arrival_date, status
// vehicles:  vehicle_id, icdv_id, manifest_id, chassis_number, release_status, operational_status
// operations:operation_id, icdv_id, vehicle_id, driver_id, operation_type, status, scheduled_date
// deliveries:delivery_id, icdv_id, vehicle_id, driver_id, status, scheduled_date

const getDashboardStats = async (icdvId = null) => {
  const sw = icdvId ? ' WHERE icdv_id = ?' : '';
  const sp = icdvId ? [icdvId] : [];

  const [
    [{ total_vessels }],
    [{ total_manifests }],
    [{ total_vehicles }],
    [{ released_vehicles }],
    [{ delivered_vehicles }],
    [{ pending_operations }],
    [{ active_operations }],
    recentVessels,
    vehiclesByStatus,
    operationsByType,
  ] = await Promise.all([

    query(`SELECT COUNT(*) AS total_vessels   FROM vessels${sw}`,   sp),
    query(`SELECT COUNT(*) AS total_manifests FROM manifests${sw}`, sp),
    query(`SELECT COUNT(*) AS total_vehicles  FROM vehicles${sw}`,  sp),

    query(`SELECT COUNT(*) AS released_vehicles FROM vehicles
           WHERE release_status IN ('released','collected')${icdvId ? ' AND icdv_id = ?' : ''}`,
      icdvId ? [icdvId] : []),

    query(`SELECT COUNT(*) AS delivered_vehicles FROM vehicles
           WHERE operational_status = 'delivered'${icdvId ? ' AND icdv_id = ?' : ''}`,
      icdvId ? [icdvId] : []),

    query(`SELECT COUNT(*) AS pending_operations FROM operations
           WHERE status = 'pending'${icdvId ? ' AND icdv_id = ?' : ''}`,
      icdvId ? [icdvId] : []),

    query(`SELECT COUNT(*) AS active_operations FROM operations
           WHERE status = 'in_progress'${icdvId ? ' AND icdv_id = ?' : ''}`,
      icdvId ? [icdvId] : []),

    // Recent vessels — only columns that actually exist in the vessels table
    // arrival_date is on manifests, not vessels — use latest manifest arrival_date
    query(`
      SELECT
        v.vessel_id,
        v.name,
        v.vessel_type,
        v.country_of_origin,
        v.status,
        v.created_at,
        COUNT(DISTINCT m.manifest_id) AS manifest_count,
        COUNT(DISTINCT vh.vehicle_id) AS vehicle_count,
        MAX(m.arrival_date)           AS latest_arrival_date
      FROM vessels v
      LEFT JOIN manifests m  ON m.vessel_id  = v.vessel_id ${icdvId ? 'AND m.icdv_id = ?' : ''}
      LEFT JOIN vehicles  vh ON vh.manifest_id = m.manifest_id
      ${icdvId ? 'WHERE v.icdv_id = ?' : ''}
      GROUP BY v.vessel_id, v.name, v.vessel_type, v.country_of_origin, v.status, v.created_at
      ORDER BY v.created_at DESC
      LIMIT 5`,
      icdvId ? [icdvId, icdvId] : []),

    query(`
      SELECT release_status, operational_status, COUNT(*) AS count
      FROM vehicles${sw}
      GROUP BY release_status, operational_status`,
      sp),

    query(`
      SELECT
        operation_type,
        COUNT(*) AS count,
        SUM(CASE WHEN status = 'completed'   THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress
      FROM operations${sw}
      GROUP BY operation_type
      ORDER BY count DESC
      LIMIT 10`,
      sp),
  ]);

  return {
    stats: {
      total_vessels,
      total_manifests,
      total_vehicles,
      released_vehicles,
      delivered_vehicles,
      pending_operations,
      active_operations,
      unreleased_vehicles: total_vehicles - released_vehicles,
    },
    recent_vessels:     recentVessels,
    vehicles_by_status: vehiclesByStatus,
    operations_by_type: operationsByType,
  };
};

const getVehicleStatusSummary = async (icdvId = null) => {
  const sw = icdvId ? ' WHERE icdv_id = ?' : '';
  const sp = icdvId ? [icdvId] : [];
  return query(`
    SELECT
      release_status,
      SUM(operational_status = 'pending')      AS pending,
      SUM(operational_status = 'in_operation') AS in_operation,
      SUM(operational_status = 'ready')        AS ready,
      SUM(operational_status = 'delivered')    AS delivered,
      COUNT(*) AS total
    FROM vehicles${sw}
    GROUP BY release_status`,
    sp);
};

module.exports = { getDashboardStats, getVehicleStatusSummary };
