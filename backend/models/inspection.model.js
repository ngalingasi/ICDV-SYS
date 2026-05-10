const httpStatus = require('http-status');
const { query, transaction } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');

// ── Request number generation ─────────────────────────────────────────────────
const generateRequestNumber = async (conn) => {
  const year = new Date().getFullYear();
  const exec = conn ? (s, p) => conn.query(s, p).then(([r]) => r) : query;
  await exec(
    `INSERT INTO inspection_number_sequences (year, last_seq) VALUES (?, 1)
     ON DUPLICATE KEY UPDATE last_seq = last_seq + 1`,
    [year]
  );
  const [row] = await exec('SELECT last_seq FROM inspection_number_sequences WHERE year = ?', [year]);
  return `INS-${year}-${String(row.last_seq).padStart(5, '0')}`;
};

// ══════════════════════════════════════════════════════════════════════════════
// CHECKLISTS
// ══════════════════════════════════════════════════════════════════════════════

const getChecklists = async ({ page, limit, search, inspection_type, status }) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  const where = []; const params = [];
  if (search)          { where.push('cl.checklist_name LIKE ?'); params.push(`%${search}%`); }
  if (inspection_type) { where.push('cl.inspection_type = ?');   params.push(inspection_type); }
  if (status)          { where.push('cl.status = ?');             params.push(status); }
  const filter = where.length ? ' AND ' + where.join(' AND ') : '';

  const [countRow] = await query(
    `SELECT COUNT(*) AS total FROM inspection_checklists cl WHERE cl.deleted_at IS NULL${filter}`, params
  );
  const rows = await query(
    `SELECT cl.*, u.full_name AS created_by_name,
            (SELECT COUNT(*) FROM checklist_items ci WHERE ci.checklist_id = cl.checklist_id) AS item_count
     FROM inspection_checklists cl
     LEFT JOIN users u ON u.user_id = cl.created_by
     WHERE cl.deleted_at IS NULL${filter}
     ORDER BY cl.created_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );
  return { results: rows, ...paginate(countRow.total) };
};

const getChecklistById = async (id) => {
  const rows = await query(
    `SELECT cl.*, u.full_name AS created_by_name
     FROM inspection_checklists cl
     LEFT JOIN users u ON u.user_id = cl.created_by
     WHERE cl.deleted_at IS NULL AND cl.checklist_id = ?`, [id]
  );
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Checklist not found');
  const cl = rows[0];
  cl.items = await query(
    'SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY item_order, checklist_item_id',
    [id]
  );
  return cl;
};

const createChecklist = async (body, userId) => {
  return transaction(async (conn) => {
    const { checklist_name, inspection_type, description = null, status = 'active', items = [] } = body;
    if (!items.length) throw new ApiError(httpStatus.BAD_REQUEST, 'At least one checklist item is required');

    const [result] = await conn.query(
      'INSERT INTO inspection_checklists (checklist_name, inspection_type, description, status, created_by) VALUES (?,?,?,?,?)',
      [checklist_name, inspection_type, description, status, userId]
    );
    const clId = result.insertId;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await conn.query(
        `INSERT INTO checklist_items
           (checklist_id, item_title, item_description, item_order, response_type, is_required, requires_comment)
         VALUES (?,?,?,?,?,?,?)`,
        [clId, item.item_title, item.item_description || null, item.item_order ?? i,
         item.response_type ?? 'pass_fail', item.is_required ?? 1, item.requires_comment ?? 0]
      );
    }
    return getChecklistById(clId);
  });
};

const updateChecklist = async (id, body, userId) => {
  await getChecklistById(id);
  return transaction(async (conn) => {
    const allowed = ['checklist_name','inspection_type','description','status'];
    const fields  = Object.keys(body).filter(k => allowed.includes(k));
    if (fields.length) {
      const set = fields.map(f => `${f} = ?`).join(', ');
      await conn.query(
        `UPDATE inspection_checklists SET ${set}, updated_by = ? WHERE checklist_id = ?`,
        [...fields.map(f => body[f]), userId, id]
      );
    }
    if (body.items !== undefined) {
      if (!body.items.length) throw new ApiError(httpStatus.BAD_REQUEST, 'At least one checklist item is required');
      await conn.query('DELETE FROM checklist_items WHERE checklist_id = ?', [id]);
      for (let i = 0; i < body.items.length; i++) {
        const item = body.items[i];
        await conn.query(
          `INSERT INTO checklist_items
             (checklist_id, item_title, item_description, item_order, response_type, is_required, requires_comment)
           VALUES (?,?,?,?,?,?,?)`,
          [id, item.item_title, item.item_description || null, item.item_order ?? i,
           item.response_type ?? 'pass_fail', item.is_required ?? 1, item.requires_comment ?? 0]
        );
      }
    }
    return getChecklistById(id);
  });
};

const deleteChecklist = async (id, userId) => {
  await getChecklistById(id);
  await query('UPDATE inspection_checklists SET deleted_at = NOW(), deleted_by = ? WHERE checklist_id = ?', [userId, id]);
};

// ══════════════════════════════════════════════════════════════════════════════
// INSPECTION REQUESTS
// ══════════════════════════════════════════════════════════════════════════════

const IR_BASE = `
  SELECT ir.*,
         po.order_number, sup.company_name AS supplier_name,
         p.name AS project_name,
         cl.checklist_name, cl.inspection_type AS cl_type,
         u.full_name AS created_by_name,
         tf.transfer_number,
         ss.store_name AS source_store_name,
         ds.store_name AS destination_store_name
  FROM inspection_requests ir
  LEFT JOIN purchase_orders po  ON po.purchase_order_id = ir.purchase_order_id
  LEFT JOIN suppliers sup       ON sup.supplier_id = po.supplier_id
  LEFT JOIN projects p          ON p.project_id = ir.project_id
  JOIN inspection_checklists cl ON cl.checklist_id = ir.checklist_id
  LEFT JOIN users u             ON u.user_id = ir.created_by
  LEFT JOIN stock_transfers tf  ON tf.transfer_id = ir.source_id AND ir.source_type = 'TRANSFER'
  LEFT JOIN stores ss           ON ss.store_id = tf.source_store_id
  LEFT JOIN stores ds           ON ds.store_id = ir.destination_store_id
  WHERE ir.deleted_at IS NULL`;

const getRequests = async ({ page, limit, search, inspection_type, status, project_id, source_type, source_id }) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  const where = []; const params = [];
  if (search)          { where.push('(ir.request_number LIKE ? OR ir.location_name LIKE ?)'); const q = `%${search}%`; params.push(q, q); }
  if (inspection_type) { where.push('ir.inspection_type = ?'); params.push(inspection_type); }
  if (status)          { where.push('ir.status = ?');          params.push(status); }
  if (project_id)      { where.push('ir.project_id = ?');      params.push(parseInt(project_id, 10)); }
  if (source_type)     { where.push('ir.source_type = ?');     params.push(source_type); }
  if (source_id)       { where.push('ir.source_id = ?');       params.push(parseInt(source_id, 10)); }
  const filter = where.length ? ' AND ' + where.join(' AND ') : '';

  const [countRow] = await query(
    `SELECT COUNT(*) AS total FROM inspection_requests ir WHERE ir.deleted_at IS NULL${filter}`, params
  );
  const rows = await query(`${IR_BASE}${filter} ORDER BY ir.created_at DESC LIMIT ? OFFSET ?`, [...params, l, offset]);

  // Attach assignment counts and accepted user ids for each request
  if (rows.length) {
    const ids = rows.map(r => r.inspection_request_id);
    const assignments = await query(
      `SELECT inspection_request_id, user_id, assignment_status
       FROM inspection_assignments
       WHERE inspection_request_id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
    rows.forEach(row => {
      const rowAssigns = assignments.filter(a => a.inspection_request_id === row.inspection_request_id);
      row.assignment_count  = rowAssigns.length;
      row.accepted_user_ids = rowAssigns.filter(a => a.assignment_status === 'accepted').map(a => a.user_id);
    });
  }

  return { results: rows, ...paginate(countRow.total) };
};

const getRequestById = async (id, conn = null) => {
  const exec = conn ? (s, p) => conn.query(s, p).then(([r]) => r) : query;
  const rows = await exec(`${IR_BASE} AND ir.inspection_request_id = ?`, [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Inspection request not found');
  const ir = rows[0];

  ir.assignments = await exec(
    `SELECT ia.*, u.full_name, u.email, u.role
     FROM inspection_assignments ia
     JOIN users u ON u.user_id = ia.user_id
     WHERE ia.inspection_request_id = ?`, [id]
  );
  ir.order_items = await exec(
    `SELECT iri.*, poi.*, pr.product_name, pr.sku_barcode
     FROM inspection_request_items iri
     JOIN purchase_order_items poi ON poi.item_id = iri.purchase_order_item_id
     JOIN products pr ON pr.product_id = poi.product_id
     WHERE iri.inspection_request_id = ?`, [id]
  );
  // Always load checklist items + responses (used for preview on detail page)
  ir.checklist_items = await exec(
    'SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY item_order, checklist_item_id',
    [ir.checklist_id]
  );
  ir.responses = await exec(
    'SELECT * FROM inspection_responses WHERE inspection_request_id = ? ORDER BY checklist_item_id',
    [id]
  );
  return ir;
};

const createRequest = async (body, userId) => {
  return transaction(async (conn) => {
    const {
      inspection_type, project_id = null,
      purchase_order_id = null, source_type = 'ORDER', source_id = null,
      destination_store_id = null, checklist_id,
      location_name, location_address = null, location_country = null,
      location_region = null, latitude = null, longitude = null,
      inspection_date, inspection_time = null,
      requires_evidence_upload = 0,
      require_evidence_on_acceptance = 0,
      location_city = null, location_region_id = null,
      request_notes = null,
      status = 'draft', assigned_user_ids = [], order_item_ids = [],
    } = body;

    const requestNumber = await generateRequestNumber(conn);

    const [result] = await conn.query(
      `INSERT INTO inspection_requests
         (request_number, inspection_type, project_id, purchase_order_id,
          source_type, source_id, destination_store_id,
          checklist_id,
          location_name, location_address, location_country, location_region,
          location_region_id, location_city,
          latitude, longitude,
          inspection_date, inspection_time,
          requires_evidence_upload, require_evidence_on_acceptance,
          request_notes, status, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [requestNumber, inspection_type, project_id, purchase_order_id || null,
       source_type || 'ORDER', source_id || null, destination_store_id || null,
       checklist_id,
       location_name, location_address, location_country, location_region,
       location_region_id || null, location_city || null,
       latitude, longitude,
       inspection_date, inspection_time,
       requires_evidence_upload ? 1 : 0, require_evidence_on_acceptance ? 1 : 0,
       request_notes, status, userId]
    );
    const irId = result.insertId;

    // Assign users
    for (const uid of assigned_user_ids) {
      await conn.query(
        'INSERT IGNORE INTO inspection_assignments (inspection_request_id, user_id) VALUES (?,?)',
        [irId, uid]
      );
    }

    // Link order items
    for (const itemId of order_item_ids) {
      await conn.query(
        'INSERT IGNORE INTO inspection_request_items (inspection_request_id, purchase_order_item_id) VALUES (?,?)',
        [irId, itemId]
      );
    }

    return getRequestById(irId, conn);
  });
};

const updateRequest = async (id, body, userId) => {
  const ir = await getRequestById(id);
  if (ir.status === 'cancelled') throw new ApiError(httpStatus.BAD_REQUEST, 'Cancelled requests cannot be edited');
  if (ir.status === 'completed') throw new ApiError(httpStatus.BAD_REQUEST, 'Completed inspections are read-only');

  return transaction(async (conn) => {
    const allowed = ['inspection_type','project_id','purchase_order_id',
                     'source_type','source_id','destination_store_id',
                     'checklist_id',
                     'location_name','location_address','location_country','location_region',
                     'location_region_id','location_city','latitude','longitude',
                     'inspection_date','inspection_time',
                     'requires_evidence_upload','require_evidence_on_acceptance',
                     'request_notes','status'];
    const fields = Object.keys(body).filter(k => allowed.includes(k));
    if (fields.length) {
      const set = fields.map(f => `${f} = ?`).join(', ');
      await conn.query(
        `UPDATE inspection_requests SET ${set}, updated_by = ? WHERE inspection_request_id = ?`,
        [...fields.map(f => body[f]), userId, id]
      );
    }
    if (body.assigned_user_ids !== undefined) {
      await conn.query('DELETE FROM inspection_assignments WHERE inspection_request_id = ?', [id]);
      for (const uid of body.assigned_user_ids) {
        await conn.query(
          'INSERT IGNORE INTO inspection_assignments (inspection_request_id, user_id) VALUES (?,?)',
          [id, uid]
        );
      }
    }
    if (body.order_item_ids !== undefined) {
      await conn.query('DELETE FROM inspection_request_items WHERE inspection_request_id = ?', [id]);
      for (const itemId of body.order_item_ids) {
        await conn.query(
          'INSERT IGNORE INTO inspection_request_items (inspection_request_id, purchase_order_item_id) VALUES (?,?)',
          [id, itemId]
        );
      }
    }
    return getRequestById(id, conn);
  });
};

const cancelRequest = async (id, userId) => {
  const ir = await getRequestById(id);
  if (ir.status === 'cancelled') throw new ApiError(httpStatus.BAD_REQUEST, 'Already cancelled');
  if (ir.status === 'completed') throw new ApiError(httpStatus.BAD_REQUEST, 'Completed inspections cannot be cancelled');
  await query(
    'UPDATE inspection_requests SET status = ?, updated_by = ? WHERE inspection_request_id = ?',
    ['cancelled', userId, id]
  );
  return getRequestById(id);
};

const deleteRequest = async (id, userId) => {
  await getRequestById(id);
  await query(
    'UPDATE inspection_requests SET deleted_at = NOW(), deleted_by = ?, updated_by = ? WHERE inspection_request_id = ?',
    [userId, userId, id]
  );
};

// ── Assignments ───────────────────────────────────────────────────────────────
// ── Assignment Evidence ───────────────────────────────────────────────────────
const uploadAssignmentEvidence = async (assignmentId, file, userId) => {
  const rows = await query('SELECT * FROM inspection_assignments WHERE inspection_assignment_id = ?', [assignmentId]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Assignment not found');
  if (rows[0].user_id !== userId) throw new ApiError(httpStatus.FORBIDDEN, 'You can only upload evidence for your own assignment');

  const result = await query(
    'INSERT INTO assignment_evidence (inspection_assignment_id, file_name, file_path, file_type, uploaded_by) VALUES (?,?,?,?,?)',
    [assignmentId, file.originalname, file.path, file.mimetype || null, userId]
  );
  return query('SELECT * FROM assignment_evidence WHERE assignment_evidence_id = ?', [result.insertId]).then(r => r[0]);
};

const getAssignmentEvidence = async (assignmentId) => {
  return query('SELECT * FROM assignment_evidence WHERE inspection_assignment_id = ? ORDER BY uploaded_at DESC', [assignmentId]);
};

const acceptAssignment = async (assignmentId, userId, remarks = null) => {
  const rows = await query(
    'SELECT * FROM inspection_assignments WHERE inspection_assignment_id = ?', [assignmentId]
  );
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Assignment not found');
  if (rows[0].user_id !== userId) throw new ApiError(httpStatus.FORBIDDEN, 'You can only respond to your own assignments');
  if (rows[0].assignment_status !== 'pending') throw new ApiError(httpStatus.BAD_REQUEST, 'Assignment already responded to');

  // Check if evidence is required before acceptance
  const irRows = await query(
    'SELECT require_evidence_on_acceptance FROM inspection_requests WHERE inspection_request_id = ?',
    [rows[0].inspection_request_id]
  );
  if (irRows.length && irRows[0].require_evidence_on_acceptance) {
    const evidence = await query(
      'SELECT COUNT(*) AS cnt FROM assignment_evidence WHERE inspection_assignment_id = ?', [assignmentId]
    );
    if (Number(evidence[0].cnt) === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'You must upload evidence before accepting this inspection request');
    }
  }

  await query(
    `UPDATE inspection_assignments
     SET assignment_status = 'accepted', accepted_at = NOW(), remarks = ?
     WHERE inspection_assignment_id = ?`,
    [remarks, assignmentId]
  );

  // Auto-advance request to scheduled if all assignments accepted
  const irId = rows[0].inspection_request_id;
  const pending = await query(
    "SELECT COUNT(*) AS cnt FROM inspection_assignments WHERE inspection_request_id = ? AND assignment_status = 'pending'",
    [irId]
  );
  if (Number(pending[0].cnt) === 0) {
    await query(
      "UPDATE inspection_requests SET status = 'scheduled' WHERE inspection_request_id = ? AND status = 'pending_acceptance'",
      [irId]
    );
  }
  return query('SELECT * FROM inspection_assignments WHERE inspection_assignment_id = ?', [assignmentId]).then(r => r[0]);
};

const rejectAssignment = async (assignmentId, userId, remarks = null) => {
  const rows = await query(
    'SELECT * FROM inspection_assignments WHERE inspection_assignment_id = ?', [assignmentId]
  );
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Assignment not found');
  if (rows[0].user_id !== userId) throw new ApiError(httpStatus.FORBIDDEN, 'You can only respond to your own assignments');
  if (rows[0].assignment_status !== 'pending') throw new ApiError(httpStatus.BAD_REQUEST, 'Assignment already responded to');

  await query(
    `UPDATE inspection_assignments
     SET assignment_status = 'rejected', rejected_at = NOW(), remarks = ?
     WHERE inspection_assignment_id = ?`,
    [remarks, assignmentId]
  );
  return query('SELECT * FROM inspection_assignments WHERE inspection_assignment_id = ?', [assignmentId]).then(r => r[0]);
};

module.exports = {
  getChecklists, getChecklistById, createChecklist, updateChecklist, deleteChecklist,
  getRequests, getRequestById, createRequest, updateRequest, cancelRequest, deleteRequest,
  acceptAssignment, rejectAssignment,
  uploadAssignmentEvidence, getAssignmentEvidence,
};

// ══════════════════════════════════════════════════════════════════════════════
// INSPECTION EXECUTION
// ══════════════════════════════════════════════════════════════════════════════

const getExecutionData = async (requestId, userId) => {
  const ir = await getRequestById(requestId);
  const assigned = ir.assignments?.find(a => a.user_id === userId);
  if (!assigned) throw new ApiError(httpStatus.FORBIDDEN, 'You are not assigned to this inspection');
  if (!['scheduled','active','inspected'].includes(ir.status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Cannot execute inspection with status "${ir.status}"`);
  }
  // Load checklist items
  const checklistItems = await query(
    'SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY item_order, checklist_item_id',
    [ir.checklist_id]
  );
  // Load existing responses
  const responses = await query(
    'SELECT * FROM inspection_responses WHERE inspection_request_id = ?', [requestId]
  );
  return { ...ir, checklist_items: checklistItems, responses };
};

const saveResponses = async (requestId, responses, userId, file = null) => {
  const ir = await getRequestById(requestId);
  const assigned = ir.assignments?.find(a => a.user_id === userId && a.assignment_status === 'accepted');
  if (!assigned) throw new ApiError(httpStatus.FORBIDDEN, 'Only accepted assignees can save responses');
  if (!['scheduled','active','inspected'].includes(ir.status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot save responses for this inspection status');
  }

  // Auto-advance to active when first responses saved
  if (ir.status === 'scheduled') {
    await query("UPDATE inspection_requests SET status = 'active' WHERE inspection_request_id = ?", [requestId]);
  }

  for (const resp of responses) {
    const evidencePath = (resp.evidence_file && file) ? file.path : null;
    const evidenceName = (resp.evidence_file && file) ? file.originalname : null;
    await query(
      `INSERT INTO inspection_responses
         (inspection_request_id, checklist_item_id, order_item_id, response_value, response_comment,
          evidence_path, evidence_name, created_by)
       VALUES (?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         response_value    = VALUES(response_value),
         response_comment  = VALUES(response_comment),
         evidence_path     = COALESCE(VALUES(evidence_path), evidence_path),
         evidence_name     = COALESCE(VALUES(evidence_name), evidence_name)`,
      [requestId, resp.checklist_item_id, resp.order_item_id || null,
       resp.response_value || null, resp.response_comment || null,
       evidencePath, evidenceName, userId]
    );
  }
  return query('SELECT * FROM inspection_responses WHERE inspection_request_id = ?', [requestId]);
};

const submitInspection = async (requestId, body, userId) => {
  const ir = await getRequestById(requestId);
  const assigned = ir.assignments?.find(a => a.user_id === userId && a.assignment_status === 'accepted');
  if (!assigned) throw new ApiError(httpStatus.FORBIDDEN, 'Only accepted assignees can submit');
  if (!['active','scheduled'].includes(ir.status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Cannot submit inspection with status "${ir.status}"`);
  }

  // Validate required checklist items answered
  const checklistItems = await query(
    'SELECT * FROM checklist_items WHERE checklist_id = ? AND is_required = 1', [ir.checklist_id]
  );
  const responses = await query(
    'SELECT checklist_item_id FROM inspection_responses WHERE inspection_request_id = ? AND response_value IS NOT NULL',
    [requestId]
  );
  const answeredIds = new Set(responses.map(r => r.checklist_item_id));
  const missing = checklistItems.filter(i => !answeredIds.has(i.checklist_item_id));
  if (missing.length) {
    throw new ApiError(httpStatus.BAD_REQUEST,
      `Required checklist items not answered: ${missing.map(i => i.item_title).join(', ')}`
    );
  }

  await query(
    `UPDATE inspection_requests
     SET status = 'pending_approval', general_remarks = ?, recommendation = ?,
         submitted_at = NOW(), submitted_by = ?, updated_by = ?
     WHERE inspection_request_id = ?`,
    [body.general_remarks || null, body.recommendation || null, userId, userId, requestId]
  );
  return getRequestById(requestId);
};

// ══════════════════════════════════════════════════════════════════════════════
// APPROVAL & STOCK
// ══════════════════════════════════════════════════════════════════════════════

const approveInspection = async (requestId, body, userId) => {
  const ir = await getRequestById(requestId);
  if (ir.status !== 'pending_approval') {
    throw new ApiError(httpStatus.BAD_REQUEST, `Cannot approve inspection with status "${ir.status}"`);
  }
  if (!body.approval_note?.trim()) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Approval note is required');
  }

  const isFA       = ir.inspection_type === 'FA';
  const isGRI      = ir.inspection_type === 'GRI';
  const isTransfer = ir.source_type === 'TRANSFER';

  // GRI (non-transfer) requires a receiving store selection; FA and TRANSFER handle store automatically
  if (isGRI && !isTransfer && !body.receiving_store_id) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Receiving store is required for Goods Receiving (GRI) inspections');
  }

  return transaction(async (conn) => {
    // 1. Create approval record
    const [appr] = await conn.query(
      `INSERT INTO inspection_approvals
         (inspection_request_id, approval_status, approval_note, receiving_store_id, approved_by)
       VALUES (?,?,?,?,?)`,
      [requestId, 'approved', body.approval_note,
       isGRI ? (body.receiving_store_id || null) : null,   // FA never stores receiving_store_id
       userId]
    );
    const approvalId = appr.insertId;

    // 2. Update request status
    await conn.query(
      "UPDATE inspection_requests SET status = 'approved', updated_by = ? WHERE inspection_request_id = ?",
      [userId, requestId]
    );

    // 3a. GRI — stock in from order items
    if (isGRI && body.receiving_store_id) {
      const exec = (s, p) => conn.query(s, p).then(([r]) => r);
      const specificItems = await exec(
        `SELECT poi.product_id, SUM(poi.quantity) AS qty
         FROM inspection_request_items iri
         JOIN purchase_order_items poi ON poi.item_id = iri.purchase_order_item_id
         WHERE iri.inspection_request_id = ? GROUP BY poi.product_id`, [requestId]
      );
      const allOrderItems = ir.purchase_order_id ? await exec(
        `SELECT poi.product_id, SUM(poi.quantity) AS qty
         FROM purchase_order_items poi WHERE poi.purchase_order_id = ?
         GROUP BY poi.product_id`, [ir.purchase_order_id]
      ) : [];
      const finalItems = (specificItems && specificItems.length)
        ? specificItems : (allOrderItems || []);
      for (const item of finalItems) {
        await conn.query(
          `INSERT INTO stock_transactions (transaction_type, store_id, product_id, quantity, source_type, source_id, notes, created_by)
           VALUES ('STOCK_IN',?,?,?,'INSPECTION_APPROVAL',?,?,?)`,
          [body.receiving_store_id, item.product_id, item.qty, approvalId, `GRI approved — ${ir.request_number}`, userId]
        );
        await conn.query(
          `INSERT INTO store_inventory (store_id, product_id, quantity) VALUES (?,?,?)
           ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
          [body.receiving_store_id, item.product_id, item.qty]
        );
      }
    }

    // 3b. TRANSFER — receive into destination store, update transfer status
    if (isTransfer && ir.source_id) {
      const transferModel = require('./transfer.model');
      // Mark transfer as received and add stock to destination store
      await transferModel.receiveTransfer(ir.source_id, approvalId, userId);
      // Update inspection request's transfer status
      await conn.query(
        "UPDATE inspection_requests SET status = 'approved', updated_by = ? WHERE inspection_request_id = ?",
        [userId, requestId]
      ).catch(() => {});
    }

    // 3c. FA — no stock movement, inspection closes as-is

    return getRequestById(requestId, conn);
  });
};

const rejectInspection = async (requestId, body, userId) => {
  const ir = await getRequestById(requestId);
  if (ir.status !== 'pending_approval') {
    throw new ApiError(httpStatus.BAD_REQUEST, `Cannot reject inspection with status "${ir.status}"`);
  }
  if (!body.approval_note?.trim()) throw new ApiError(httpStatus.BAD_REQUEST, 'Rejection reason is required');

  await query(
    `INSERT INTO inspection_approvals
       (inspection_request_id, approval_status, approval_note, approved_by)
     VALUES (?,?,?,?)`,
    [requestId, 'rejected', body.approval_note, userId]
  );
  await query(
    "UPDATE inspection_requests SET status = 'rejected', updated_by = ? WHERE inspection_request_id = ?",
    [userId, requestId]
  );
  return getRequestById(requestId);
};

const getStoreStock = async (storeId) => {
  return query(
    `SELECT si.*, p.product_name, p.sku_barcode, p.product_type,
            c.name AS category_name, s.store_name, r.region_name
     FROM store_inventory si
     JOIN products p ON p.product_id = si.product_id
     LEFT JOIN product_categories c ON c.category_id = p.category_id
     JOIN stores s ON s.store_id = si.store_id
     LEFT JOIN regions r ON r.region_id = s.region_id
     WHERE si.store_id = ?
     ORDER BY p.product_name`, [storeId]
  );
};

const getStockTransactions = async ({ store_id, product_id, limit = 50 }) => {
  const where = []; const params = [];
  if (store_id)   { where.push('st.store_id = ?');   params.push(store_id); }
  if (product_id) { where.push('st.product_id = ?'); params.push(product_id); }
  const filter = where.length ? 'WHERE ' + where.join(' AND ') : '';
  return query(
    `SELECT st.*, p.product_name, s.store_name, u.full_name AS created_by_name
     FROM stock_transactions st
     JOIN products p ON p.product_id = st.product_id
     JOIN stores   s ON s.store_id   = st.store_id
     JOIN users    u ON u.user_id    = st.created_by
     ${filter}
     ORDER BY st.transaction_date DESC LIMIT ?`,
    [...params, parseInt(limit, 10)]
  );
};

module.exports = {
  getChecklists, getChecklistById, createChecklist, updateChecklist, deleteChecklist,
  getRequests, getRequestById, createRequest, updateRequest, cancelRequest, deleteRequest,
  acceptAssignment, rejectAssignment, uploadAssignmentEvidence, getAssignmentEvidence,
  getExecutionData, saveResponses, submitInspection,
  approveInspection, rejectInspection,
  getStoreStock, getStockTransactions,
};
