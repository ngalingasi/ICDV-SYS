import client from './client';
import type { Project, PaginatedResponse } from '../types';

export interface ProjectFilters {
  page?: number;
  limit?: number;
  sector_id?: number;
  search?: string;
}

export const projectsApi = {
  list: (params?: ProjectFilters) =>
    client.get<PaginatedResponse<Project>>('/projects', { params }),

  get: (id: number) =>
    client.get<Project>(`/projects/${id}`),

  create: (data: Partial<Project>) =>
    client.post<Project>('/projects', data),

  update: (id: number, data: Partial<Project>) =>
    client.patch<Project>(`/projects/${id}`, data),

  delete: (id: number) =>
    client.delete(`/projects/${id}`),
};
