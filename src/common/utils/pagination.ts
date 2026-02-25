import { PaginationMeta, PaginationQuery } from '../types/api-response';

export function parsePagination(query: any): Required<Pick<PaginationQuery, 'page' | 'limit'>> & PaginationQuery {
  return {
    page: Math.max(1, parseInt(query.page, 10) || 1),
    limit: Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20)),
    search: query.search || undefined,
    sortBy: query.sortBy || undefined,
    sortOrder: query.sortOrder === 'DESC' ? 'DESC' : 'ASC',
  };
}

export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
