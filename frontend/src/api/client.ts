import axios from 'axios'
import type {
  Project, ProjectCreate,
  Cabinet, CabinetCreate, CabinetUpdate,
  Component, ComponentCreate,
  FieldComponent, FieldComponentCreate, FieldComponentUpdate,
  ComponentTypical, TypicalCreate,
  Connection, ConnectionCreate, ConnectionUpdate,
  ElectricalTest, TestCreate, TestUpdate,
  CanvasOverview, CanvasPositionUpdate,
  Space, SpaceCreate, SpaceTree,
  EtimClass,
} from './types'

const api = axios.create({ baseURL: '/api/v1' })

export const projectsApi = {
  list: () => api.get<Project[]>('/projects').then(r => r.data),
  get: (id: string) => api.get<Project>(`/projects/${id}`).then(r => r.data),
  create: (body: ProjectCreate) => api.post<Project>('/projects', body).then(r => r.data),
  update: (id: string, body: Partial<ProjectCreate>) => api.put<Project>(`/projects/${id}`, body).then(r => r.data),
  delete: (id: string) => api.delete(`/projects/${id}`),
}

export const typicalsApi = {
  list: () => api.get<ComponentTypical[]>('/typicals').then(r => r.data),
  create: (body: TypicalCreate) => api.post<ComponentTypical>('/typicals', body).then(r => r.data),
  delete: (id: string) => api.delete(`/typicals/${id}`),
}

export const spacesApi = {
  listTree: (projectId: string) => api.get<SpaceTree[]>(`/projects/${projectId}/spaces/tree`).then(r => r.data),
  list: (projectId: string) => api.get<Space[]>(`/projects/${projectId}/spaces`).then(r => r.data),
  create: (projectId: string, body: SpaceCreate) => api.post<Space>(`/projects/${projectId}/spaces`, body).then(r => r.data),
  update: (id: string, body: Partial<SpaceCreate>) => api.put<Space>(`/spaces/${id}`, body).then(r => r.data),
  delete: (id: string) => api.delete(`/spaces/${id}`),
}

export const cabinetsApi = {
  list: (projectId: string) => api.get<Cabinet[]>(`/projects/${projectId}/cabinets`).then(r => r.data),
  create: (projectId: string, body: CabinetCreate) => api.post<Cabinet>(`/projects/${projectId}/cabinets`, body).then(r => r.data),
  update: (id: string, body: CabinetUpdate) => api.put<Cabinet>(`/cabinets/${id}`, body).then(r => r.data),
  delete: (id: string) => api.delete(`/cabinets/${id}`),
}

export const componentsApi = {
  list: (cabinetId: string) => api.get<Component[]>(`/cabinets/${cabinetId}/components`).then(r => r.data),
  create: (cabinetId: string, body: ComponentCreate) => api.post<Component>(`/cabinets/${cabinetId}/components`, body).then(r => r.data),
  delete: (id: string) => api.delete(`/components/${id}`),
}

export const fieldComponentsApi = {
  list: (projectId: string) => api.get<FieldComponent[]>(`/projects/${projectId}/field-components`).then(r => r.data),
  create: (projectId: string, body: FieldComponentCreate) => api.post<FieldComponent>(`/projects/${projectId}/field-components`, body).then(r => r.data),
  update: (id: string, body: FieldComponentUpdate) => api.put<FieldComponent>(`/field-components/${id}`, body).then(r => r.data),
  delete: (id: string) => api.delete(`/field-components/${id}`),
}

export const connectionsApi = {
  list: (projectId: string) => api.get<Connection[]>(`/projects/${projectId}/connections`).then(r => r.data),
  create: (projectId: string, body: ConnectionCreate) => api.post<Connection>(`/projects/${projectId}/connections`, body).then(r => r.data),
  update: (id: string, body: ConnectionUpdate) => api.patch<Connection>(`/connections/${id}`, body).then(r => r.data),
  delete: (id: string) => api.delete(`/connections/${id}`),
}

export const testsApi = {
  listByComponent: (componentId: string) => api.get<ElectricalTest[]>(`/tests/by-component/${componentId}`).then(r => r.data),
  listByFieldComponent: (fcId: string) => api.get<ElectricalTest[]>(`/tests/by-field-component/${fcId}`).then(r => r.data),
  create: (body: TestCreate) => api.post<ElectricalTest>('/tests', body).then(r => r.data),
  update: (id: string, body: TestUpdate) => api.put<ElectricalTest>(`/tests/${id}`, body).then(r => r.data),
  delete: (id: string) => api.delete(`/tests/${id}`),
}

export const canvasApi = {
  getOverview: (projectId: string) => api.get<CanvasOverview>(`/projects/${projectId}/canvas/overview`).then(r => r.data),
  savePositions: (projectId: string, positions: CanvasPositionUpdate[]) =>
    api.put(`/projects/${projectId}/canvas/positions`, positions),
}

export const etimApi = {
  search: (q: string) => api.get<EtimClass[]>(`/etim/search?q=${encodeURIComponent(q)}&limit=30`).then(r => r.data),
}
