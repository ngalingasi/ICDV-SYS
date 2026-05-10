const httpStatus = require('http-status');
const { query, transaction } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');

const createProject = async (body, creatorId) => {
  return transaction(async (conn) => {
    const {
      name,
      programme_name          = null,
      project_nature          = null,
      sector_id               = null,
      sub_sector              = null,
      start_date              = null,
      end_date                = null,
      fund_structure          = null,
      funding                 = null,
      estimated_cost          = null,
      project_life_span       = null,
      project_background      = null,
      project_objectives      = null,
      project_main_activities = null,
      project_beneficiaries   = null,
      project_use_capacity    = null,
      project_scope           = null,
      cost_center             = null,
      project_reference       = null,
      relevancy_fypds         = null,
      implementation_modality = null,
      compensation            = null,
      has_land                = 0,
      job_created_no          = null,
      project_manager_id      = null,
      regions                 = [],
      implementers            = [],
      coordinators            = [],
      employment              = [],
      financing               = [],
    } = body;

    const [result] = await conn.query(
      `INSERT INTO projects (
        name, programme_name, project_nature, sector_id, sub_sector,
        start_date, end_date,
        fund_structure, funding, estimated_cost, project_life_span,
        project_background, project_objectives, project_main_activities,
        project_beneficiaries, project_use_capacity, project_scope,
        cost_center, project_reference, relevancy_fypds,
        implementation_modality, compensation, has_land, job_created_no,
        project_manager_id, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [name, programme_name, project_nature, sector_id, sub_sector,
       start_date, end_date,
       fund_structure, funding, estimated_cost, project_life_span,
       project_background, project_objectives, project_main_activities,
       project_beneficiaries, project_use_capacity, project_scope,
       cost_center, project_reference, relevancy_fypds,
       implementation_modality, compensation, has_land, job_created_no,
       project_manager_id, creatorId]
    );
    const projectId = result.insertId;

    // Regions
    for (const r of regions) {
      const regionId = typeof r === 'object' ? r.region_id : r;
      await conn.query(
        'INSERT INTO project_regions (project_id, region_id, created_by) VALUES (?,?,?)',
        [projectId, regionId, creatorId]
      );
    }

    // Implementers
    for (const impl of implementers) {
      await conn.query(
        `INSERT INTO project_implementers
           (project_id, implementer_id, vote_name, vote_code, sub_vote_code,
            sub_vote_name, cost_center, involvement, role_type, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [projectId, impl.implementer_id, impl.vote_name ?? null, impl.vote_code ?? null,
         impl.sub_vote_code ?? null, impl.sub_vote_name ?? null, impl.cost_center ?? null,
         impl.involvement ?? null, impl.role_type ?? 'implementer', creatorId]
      );
    }

    // Coordinators
    for (const coord of coordinators) {
      await conn.query(
        `INSERT INTO project_coordinators
           (project_id, full_name, email, phone_number, address, created_by)
         VALUES (?,?,?,?,?,?)`,
        [projectId, coord.full_name, coord.email ?? null,
         coord.phone_number ?? null, coord.address ?? null, creatorId]
      );
    }

    // Employment categories
    for (const emp of employment) {
      await conn.query(
        `INSERT INTO project_employment
           (project_id, category, type, foreign_count, domestic_count)
         VALUES (?,?,?,?,?)`,
        [projectId, emp.category, emp.type, emp.foreign_count ?? 0, emp.domestic_count ?? 0]
      );
    }

    // Financing sources
    for (const f of financing) {
      await conn.query(
        `INSERT INTO project_financing
           (project_id, fund_source, financial_modality, financial_category, financier,
            committed_amount, exchange_rate, currency, amount_tzs, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [projectId, f.fund_source ?? null, f.financial_modality ?? null,
         f.financial_category ?? null, f.financier ?? null,
         f.committed_amount ?? null, f.exchange_rate ?? null,
         f.currency ?? 'TZS',
         f.committed_amount && f.exchange_rate ? f.committed_amount * f.exchange_rate : null,
         creatorId]
      );
    }

    return getProjectById(projectId, conn);
  });
};

const getProjects = async ({ page, limit, sector_id, search }) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  let where = '1=1';
  const params = [];
  if (sector_id) { where += ' AND p.sector_id = ?'; params.push(parseInt(sector_id, 10)); }
  if (search) {
    where += ' AND (p.name LIKE ? OR p.programme_name LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s);
  }
  const [countRow] = await query(`SELECT COUNT(*) AS total FROM projects p WHERE ${where}`, params);
  const projects = await query(
    `SELECT p.*, s.name AS sector_name, u.full_name AS project_manager_name
     FROM projects p
     LEFT JOIN sectors s ON s.sector_id = p.sector_id
     LEFT JOIN users u   ON u.user_id   = p.project_manager_id
     WHERE ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );
  return { results: projects, ...paginate(countRow.total) };
};

const getProjectById = async (id, conn = null) => {
  const exec = conn
    ? (sql, p) => conn.query(sql, p).then(([rows]) => rows)
    : (sql, p) => query(sql, p);

  const rows = await exec(
    `SELECT p.*, s.name AS sector_name, u.full_name AS project_manager_name
     FROM projects p
     LEFT JOIN sectors s ON s.sector_id = p.sector_id
     LEFT JOIN users u   ON u.user_id   = p.project_manager_id
     WHERE p.project_id = ?`,
    [id]
  );
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  const project = rows[0];

  // Regions
  project.regions = await exec(
    `SELECT r.*, pr.project_region_id
     FROM regions r
     JOIN project_regions pr ON pr.region_id = r.region_id
     WHERE pr.project_id = ?`,
    [id]
  );

  // Implementers with role_type
  project.implementers = await exec(
    `SELECT i.*, pi.vote_name, pi.vote_code, pi.sub_vote_code, pi.sub_vote_name,
            pi.cost_center, pi.involvement, pi.role_type, pi.id AS link_id
     FROM implementers i
     JOIN project_implementers pi ON pi.implementer_id = i.implementer_id
     WHERE pi.project_id = ?`,
    [id]
  );

  // Coordinators
  project.coordinators = await exec(
    'SELECT * FROM project_coordinators WHERE project_id = ? ORDER BY coordinator_id',
    [id]
  );

  // Employment
  project.employment = await exec(
    'SELECT * FROM project_employment WHERE project_id = ? ORDER BY employment_id',
    [id]
  );

  // Financing sources
  project.financing = await exec(
    'SELECT * FROM project_financing WHERE project_id = ? ORDER BY financing_id',
    [id]
  );

  // Objectives summary
  project.objectives = await exec(
    'SELECT objective_id, title, priority, status FROM objectives WHERE project_id = ?',
    [id]
  );

  return project;
};

const updateProject = async (id, body, updatorId) => {
  const allowed = [
    'name', 'programme_name', 'project_nature', 'sector_id', 'sub_sector',
    'start_date', 'end_date', 'fund_structure',
    'funding', 'estimated_cost', 'project_life_span',
    'project_background', 'project_objectives', 'project_main_activities',
    'project_beneficiaries', 'project_use_capacity', 'project_scope',
    'cost_center', 'project_reference', 'relevancy_fypds',
    'implementation_modality', 'compensation', 'has_land', 'job_created_no',
    'project_manager_id',
  ];
  const fields = Object.keys(body).filter((k) => allowed.includes(k));
  const hasRelations = ['regions','implementers','coordinators','employment','financing']
    .some(k => body[k] !== undefined);

  if (!fields.length && !hasRelations) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'No valid fields to update');
  }

  // Update scalar fields
  if (fields.length) {
    const setClauses = fields.map((f) => `${f} = ?`).join(', ');
    const values     = fields.map((f) => body[f]);
    await query(`UPDATE projects SET ${setClauses} WHERE project_id = ?`, [...values, id]);
  }

  // Regions
  if (body.regions !== undefined) {
    await query('DELETE FROM project_regions WHERE project_id = ?', [id]);
    for (const r of (body.regions ?? [])) {
      const regionId = typeof r === 'object' ? r.region_id : r;
      await query(
        'INSERT INTO project_regions (project_id, region_id, created_by) VALUES (?,?,?)',
        [id, regionId, updatorId]
      );
    }
  }

  // Implementers
  if (body.implementers !== undefined) {
    await query('DELETE FROM project_implementers WHERE project_id = ?', [id]);
    for (const impl of (body.implementers ?? [])) {
      if (!impl.implementer_id) continue;
      await query(
        `INSERT INTO project_implementers
           (project_id, implementer_id, vote_name, vote_code, sub_vote_code,
            sub_vote_name, cost_center, involvement, role_type, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [id, impl.implementer_id, impl.vote_name ?? null, impl.vote_code ?? null,
         impl.sub_vote_code ?? null, impl.sub_vote_name ?? null,
         impl.cost_center ?? null, impl.involvement ?? null,
         impl.role_type ?? 'implementer', updatorId]
      );
    }
  }

  // Coordinators
  if (body.coordinators !== undefined) {
    await query('DELETE FROM project_coordinators WHERE project_id = ?', [id]);
    for (const coord of (body.coordinators ?? [])) {
      if (!coord.full_name?.trim()) continue;
      await query(
        `INSERT INTO project_coordinators
           (project_id, full_name, email, phone_number, address, created_by)
         VALUES (?,?,?,?,?,?)`,
        [id, coord.full_name, coord.email ?? null,
         coord.phone_number ?? null, coord.address ?? null, updatorId]
      );
    }
  }

  // Employment
  if (body.employment !== undefined) {
    await query('DELETE FROM project_employment WHERE project_id = ?', [id]);
    for (const emp of (body.employment ?? [])) {
      if (!emp.category?.trim()) continue;
      await query(
        `INSERT INTO project_employment
           (project_id, category, type, foreign_count, domestic_count)
         VALUES (?,?,?,?,?)`,
        [id, emp.category, emp.type ?? '', emp.foreign_count ?? 0, emp.domestic_count ?? 0]
      );
    }
  }

  // Financing
  if (body.financing !== undefined) {
    await query('DELETE FROM project_financing WHERE project_id = ?', [id]);
    for (const f of (body.financing ?? [])) {
      await query(
        `INSERT INTO project_financing
           (project_id, fund_source, financial_modality, financial_category, financier,
            committed_amount, exchange_rate, currency, amount_tzs)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [id, f.fund_source ?? null, f.financial_modality ?? null,
         f.financial_category ?? null, f.financier ?? null,
         f.committed_amount ?? null, f.exchange_rate ?? null, f.currency ?? 'TZS',
         f.committed_amount && f.exchange_rate
           ? Number(f.committed_amount) * Number(f.exchange_rate) : null]
      );
    }
  }

  return getProjectById(id);
};

const deleteProject = async (id) => {
  const rows = await query('SELECT project_id FROM projects WHERE project_id = ?', [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  await query('DELETE FROM projects WHERE project_id = ?', [id]);
};

module.exports = { createProject, getProjects, getProjectById, updateProject, deleteProject };
