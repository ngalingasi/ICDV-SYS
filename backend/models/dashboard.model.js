const { query } = require('../config/database');

const getDashboardStats = async (icdvId = null) => {
  const w  = icdvId ? ' WHERE icdv_id=?' : '';
  const p  = icdvId ? [icdvId] : [];
  // Shared joins need table-prefixed WHERE
  const vw = icdvId ? ' WHERE v.icdv_id=?' : '';
  const vp = icdvId ? [icdvId] : [];

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
    query(`SELECT COUNT(*) AS total_vessels FROM vessels${w}`,   p),
    query(`SELECT COUNT(*) AS total_manifests FROM manifests${w}`, p),
    query(`SELECT COUNT(*) AS total_vehicles FROM vehicles${w}`,  p),
    query(`SELECT COUNT(*) AS released_vehicles FROM vehicles WHERE release_status IN ('released','collected')${icdvId ? ' AND icdv_id=?' : ''}`, p),
    query(`SELECT COUNT(*) AS delivered_vehicles FROM vehicles WHERE operational_status='delivered'${icdvId ? ' AND icdv_id=?' : ''}`, p),
    query(`SELECT COUNT(*) AS pending_operations FROM operations WHERE status='pending'${icdvId ? ' AND icdv_id=?' : ''}`, p),
    query(`SELECT COUNT(*) AS active_operations FROM operations WHERE status='in_progress'${icdvId ? ' AND icdv_id=?' : ''}`, p),
    query(`
      SELECT v.vessel_id, v.name, v.arrival_date, v.status, v.shipping_line,
        COUNT(m.manifest_id) AS manifest_count,
        (SELECT COUNT(*) FROM manifests mm
         JOIN vehicles vh ON vh.manifest_id = mm.manifest_id
         WHERE mm.vessel_id = v.vessel_id) AS vehicle_count
      FROM vessels v
      LEFT JOIN manifests m ON m.vessel_id = v.vessel_id
      ${icdvId ? 'WHERE v.icdv_id=?' : ''}
      GROUP BY v.vessel_id
      ORDER BY v.arrival_date DESC LIMIT 5`, vp),
    query(`
      SELECT release_status, operational_status, COUNT(*) AS count
      FROM vehicles${w}
      GROUP BY release_status, operational_status`, p),
    query(`
      SELECT operation_type, COUNT(*) AS count,
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) AS in_progress
      FROM operations${w}
      GROUP BY operation_type ORDER BY count DESC LIMIT 10`, p),
  ]);

  return {
    stats: {
      total_vessels, total_manifests, total_vehicles,
      released_vehicles, delivered_vehicles,
      pending_operations, active_operations,
      unreleased_vehicles: total_vehicles - released_vehicles,
    },
    recent_vessels:     recentVessels,
    vehicles_by_status: vehiclesByStatus,
    operations_by_type: operationsByType,
  };
};

const getVehicleStatusSummary = async (icdvId = null) => {
  const w = icdvId ? ' WHERE icdv_id=?' : '';
  const p = icdvId ? [icdvId] : [];
  return query(`
    SELECT
      release_status,
      SUM(operational_status='pending')      AS pending,
      SUM(operational_status='in_operation') AS in_operation,
      SUM(operational_status='ready')        AS ready,
      SUM(operational_status='delivered')    AS delivered,
      COUNT(*) AS total
    FROM vehicles${w}
    GROUP BY release_status`, p);
};

module.exports = { getDashboardStats, getVehicleStatusSummary };
