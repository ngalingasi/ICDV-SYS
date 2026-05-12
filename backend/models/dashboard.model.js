const { query } = require('../config/database');

// Schema:
// vessels:          vessel_id, icdv_id, name, imo_number, vessel_type, country_of_origin, status
// manifests:        manifest_id, icdv_id, vessel_id, manifest_number, arrival_date, status
// vehicles:         vehicle_id, icdv_id, manifest_id, chassis_number,
//                   release_status, operational_status,
//                   workflow_status (manifested|discharged|batched|in_transit|received),
//                   current_location
// batches:          batch_id, icdv_id, vessel_id, batch_number, batch_date, vehicle_count, status
// transfers:        transfer_id, icdv_id, vehicle_id, status
// vehicle_operations: op_id, icdv_id, vehicle_id, operation_type
// (old) operations: operation_id, icdv_id, vehicle_id, status — kept for future use

const getDashboardStats = async (icdvId = null) => {
  const sw = icdvId ? ' WHERE icdv_id = ?' : '';
  const sp = icdvId ? [icdvId] : [];

  const [
    [{ total_vessels }],
    [{ total_manifests }],
    [{ total_vehicles }],
    [{ released_vehicles }],
    [{ delivered_vehicles }],
    // Workflow counts
    [{ manifested_count }],
    [{ discharged_count }],
    [{ batched_count }],
    [{ in_transit_count }],
    [{ received_count }],
    [{ open_batches }],
    recentVessels,
    workflowByStatus,
  ] = await Promise.all([

    query(`SELECT COUNT(*) AS total_vessels   FROM vessels${sw}`,   sp),
    query(`SELECT COUNT(*) AS total_manifests FROM manifests${sw}`, sp),
    query(`SELECT COUNT(*) AS total_vehicles  FROM vehicles${sw}`,  sp),

    query(`SELECT COUNT(*) AS released_vehicles FROM vehicles
           WHERE release_status IN ('released','collected')${icdvId ? ' AND icdv_id = ?' : ''}`,
      icdvId ? [icdvId] : []),

    query(`SELECT COUNT(*) AS delivered_vehicles FROM vehicles
           WHERE workflow_status = 'received'${icdvId ? ' AND icdv_id = ?' : ''}`,
      icdvId ? [icdvId] : []),

    // Workflow step counts
    query(`SELECT COUNT(*) AS manifested_count FROM vehicles
           WHERE workflow_status = 'manifested'${icdvId ? ' AND icdv_id = ?' : ''}`,
      icdvId ? [icdvId] : []),

    query(`SELECT COUNT(*) AS discharged_count FROM vehicles
           WHERE workflow_status = 'discharged'${icdvId ? ' AND icdv_id = ?' : ''}`,
      icdvId ? [icdvId] : []),

    query(`SELECT COUNT(*) AS batched_count FROM vehicles
           WHERE workflow_status = 'batched'${icdvId ? ' AND icdv_id = ?' : ''}`,
      icdvId ? [icdvId] : []),

    query(`SELECT COUNT(*) AS in_transit_count FROM vehicles
           WHERE workflow_status = 'in_transit'${icdvId ? ' AND icdv_id = ?' : ''}`,
      icdvId ? [icdvId] : []),

    query(`SELECT COUNT(*) AS received_count FROM vehicles
           WHERE workflow_status = 'received'${icdvId ? ' AND icdv_id = ?' : ''}`,
      icdvId ? [icdvId] : []),

    query(`SELECT COUNT(*) AS open_batches FROM batches
           WHERE status = 'open'${icdvId ? ' AND icdv_id = ?' : ''}`,
      icdvId ? [icdvId] : []),

    // Recent vessels
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
      LEFT JOIN manifests m  ON m.vessel_id   = v.vessel_id ${icdvId ? 'AND m.icdv_id = ?' : ''}
      LEFT JOIN vehicles  vh ON vh.manifest_id = m.manifest_id
      ${icdvId ? 'WHERE v.icdv_id = ?' : ''}
      GROUP BY v.vessel_id, v.name, v.vessel_type, v.country_of_origin, v.status, v.created_at
      ORDER BY v.created_at DESC
      LIMIT 5`,
      icdvId ? [icdvId, icdvId] : []),

    // Workflow status breakdown
    query(`
      SELECT workflow_status, COUNT(*) AS count
      FROM vehicles${sw}
      GROUP BY workflow_status
      ORDER BY FIELD(workflow_status,'manifested','discharged','batched','in_transit','received')`,
      sp),
  ]);

  return {
    stats: {
      total_vessels,
      total_manifests,
      total_vehicles,
      released_vehicles,
      delivered_vehicles,
      unreleased_vehicles: total_vehicles - released_vehicles,
      // Workflow step counts
      manifested_count,
      discharged_count,
      batched_count,
      in_transit_count,
      received_count,
      open_batches,
    },
    recent_vessels:      recentVessels,
    workflow_by_status:  workflowByStatus,
    // old operations_by_type removed from dashboard
    // kept in operations model for later use
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
