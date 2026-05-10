const { query } = require('../config/database');

const getDashboardStats = async () => {
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
    query('SELECT COUNT(*) AS total_vessels FROM vessels'),
    query('SELECT COUNT(*) AS total_manifests FROM manifests'),
    query('SELECT COUNT(*) AS total_vehicles FROM vehicles'),
    query("SELECT COUNT(*) AS released_vehicles FROM vehicles WHERE release_status IN ('released','collected')"),
    query("SELECT COUNT(*) AS delivered_vehicles FROM vehicles WHERE operational_status='delivered'"),
    query("SELECT COUNT(*) AS pending_operations FROM operations WHERE status='pending'"),
    query("SELECT COUNT(*) AS active_operations FROM operations WHERE status='in_progress'"),
    query(`
      SELECT v.vessel_id, v.name, v.arrival_date, v.status, v.shipping_line,
        COUNT(m.manifest_id) AS manifest_count,
        (SELECT COUNT(*) FROM manifests mm
         JOIN vehicles vh ON vh.manifest_id = mm.manifest_id
         WHERE mm.vessel_id = v.vessel_id) AS vehicle_count
      FROM vessels v
      LEFT JOIN manifests m ON m.vessel_id = v.vessel_id
      GROUP BY v.vessel_id
      ORDER BY v.arrival_date DESC
      LIMIT 5
    `),
    query(`
      SELECT
        release_status,
        operational_status,
        COUNT(*) AS count
      FROM vehicles
      GROUP BY release_status, operational_status
    `),
    query(`
      SELECT operation_type, COUNT(*) AS count,
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) AS in_progress
      FROM operations
      GROUP BY operation_type
      ORDER BY count DESC
      LIMIT 10
    `),
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
    recent_vessels: recentVessels,
    vehicles_by_status: vehiclesByStatus,
    operations_by_type: operationsByType,
  };
};

const getVehicleStatusSummary = async () => {
  return query(`
    SELECT
      release_status,
      COUNT(*) AS total,
      SUM(CASE WHEN operational_status='delivered' THEN 1 ELSE 0 END) AS delivered,
      SUM(CASE WHEN operational_status='ready' THEN 1 ELSE 0 END) AS ready,
      SUM(CASE WHEN operational_status='in_operation' THEN 1 ELSE 0 END) AS in_operation,
      SUM(CASE WHEN operational_status='pending' THEN 1 ELSE 0 END) AS pending
    FROM vehicles
    GROUP BY release_status
  `);
};

module.exports = { getDashboardStats, getVehicleStatusSummary };
