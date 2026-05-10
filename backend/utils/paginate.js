/**
 * Build pagination metadata and LIMIT/OFFSET clause
 * @param {number|string} page  - 1-based page number (Express sends strings)
 * @param {number|string} limit - items per page
 * @returns {{ limit, offset, paginate }}
 */
const buildPagination = (page = 1, limit = 10) => {
  // Query params arrive as strings from Express — parse safely with fallback
  const p = Math.max(parseInt(page, 10) || 1, 1);
  const l = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

  // Bitwise OR forces integer primitive — mysql2 prepared statements
  // reject NaN, floats and string coercions for LIMIT/OFFSET
  const safeLimit  = l | 0;
  const safeOffset = ((p - 1) * l) | 0;

  const paginate = (totalResults) => ({
    page:         p,
    limit:        safeLimit,
    totalPages:   Math.ceil(totalResults / safeLimit),
    totalResults: Number(totalResults),
  });

  return { limit: safeLimit, offset: safeOffset, paginate };
};

module.exports = { buildPagination };
