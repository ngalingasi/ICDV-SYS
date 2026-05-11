/**
 * Build pagination metadata and LIMIT/OFFSET clause
 */
const buildPagination = (page = 1, limit = 10) => {
  const p = Math.max(parseInt(page, 10) || 1, 1);
  const l = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
  const safeLimit  = l | 0;
  const safeOffset = ((p - 1) * l) | 0;

  // paginate(rows, total) → { results, page, limit, totalPages, totalResults }
  const paginate = (rows, totalResults) => ({
    results:      rows,
    page:         p,
    limit:        safeLimit,
    totalPages:   Math.ceil(Number(totalResults) / safeLimit),
    totalResults: Number(totalResults),
  });

  return { limit: safeLimit, offset: safeOffset, paginate };
};

module.exports = { buildPagination };
