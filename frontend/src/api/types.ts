export interface Project {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}
export interface ProjectCreate {
  name: string
  description?: string
}

export interface ComponentTypical {
  id: string
  name: string
  code: string
  family: string | null
  symbol: string | null
  description: string | null
  etim_class_id: string | null
  etim_class_desc: string | null
  created_at: string
}
export interface TypicalCreate {
  name: string
  code: string
  family?: string
  description?: string
  etim_class_id?: string
  etim_class_desc?: string
}

export type CabinetType = 'hoofdverdeler' | 'onderverdeler' | 'besturingskast' | 'netwerkkast' | 'klemmenkast'

export const CABINET_TYPES: { value: CabinetType; label: string }[] = [
  { value: 'hoofdverdeler', label: 'Hoofdverdeler' },
  { value: 'onderverdeler', label: 'Onderverdeler' },
  { value: 'besturingskast', label: 'Besturingskast' },
  { value: 'netwerkkast', label: 'Netwerkkast' },
  { value: 'klemmenkast', label: 'Klemmenkast' },
]

export interface Cabinet {
  id: string
  project_id: string
  name: string
  tag: string | null
  function_designation: string | null
  cabinet_type: string | null
  space_id: string | null
  description: string | null
  component_count: number
  created_at: string
  updated_at: string
}
export interface CabinetCreate {
  name: string
  cabinet_type: CabinetType
  description?: string
  space_id?: string
  function_designation?: string
}
export interface CabinetUpdate {
  name?: string
  cabinet_type?: CabinetType | null
  description?: string | null
  space_id?: string | null
  function_designation?: string | null
}

export interface Component {
  id: string
  cabinet_id: string
  name: string
  tag: string | null
  position_order: number
  typical: ComponentTypical | null
  created_at: string
  updated_at: string
}
export interface ComponentCreate {
  name: string
  tag?: string
  typical_id?: string
  position_order?: number
}

export interface FieldComponent {
  id: string
  project_id: string
  name: string
  tag: string | null
  function_designation: string | null
  description: string | null
  space_id: string | null
  typical: ComponentTypical | null
  created_at: string
  updated_at: string
}
export interface FieldComponentCreate {
  name: string
  tag?: string
  typical_id?: string
  description?: string
  space_id?: string
  function_designation?: string
}
export interface FieldComponentUpdate {
  name?: string
  tag?: string | null
  typical_id?: string | null
  description?: string | null
  space_id?: string | null
  function_designation?: string | null
}

export interface Space {
  id: string
  project_id: string
  parent_id: string | null
  name: string
  designation: string | null
  level_type: string | null
  created_at: string
  updated_at: string
}
export interface SpaceCreate {
  name: string
  parent_id?: string
  designation?: string
  level_type?: string
}
export interface SpaceTree extends Space {
  children: SpaceTree[]
}

export const LEVEL_TYPES = [
  { value: 'gebouw', label: 'Gebouw' },
  { value: 'verdieping', label: 'Verdieping' },
  { value: 'ruimte', label: 'Ruimte' },
  { value: 'zone', label: 'Zone' },
]

export interface Connection {
  id: string
  project_id: string
  source_type: string
  source_id: string
  target_type: string
  target_id: string
  label: string | null
  cable_ref: string | null
  cable_type: string | null
  cable_section: number | null
  cable_length: number | null
  created_at: string
  updated_at: string
}
export interface ConnectionCreate {
  source_type: string
  source_id: string
  target_type: string
  target_id: string
  label?: string
  cable_ref?: string
  cable_type?: string
  cable_section?: number
  cable_length?: number
}
export interface ConnectionUpdate {
  label?: string | null
  cable_ref?: string | null
  cable_type?: string | null
  cable_section?: number | null
  cable_length?: number | null
}

export interface ElectricalTest {
  id: string
  component_id: string | null
  field_component_id: string | null
  name: string
  test_type: string
  expected_value: string | null
  unit: string | null
  actual_value: string | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}
export interface TestCreate {
  name: string
  test_type: string
  component_id?: string
  field_component_id?: string
  expected_value?: string
  unit?: string
  notes?: string
}
export interface TestUpdate {
  name?: string
  test_type?: string
  expected_value?: string
  unit?: string
  actual_value?: string
  status?: string
  notes?: string
}

export interface SpaceZoneData {
  [key: string]: unknown
  id: string
  name: string
  designation: string | null
  level_type: string | null
}

export interface EtimClass {
  id: string
  desc: string
  group: string | null
}

export interface CanvasNodeData {
  [key: string]: unknown
  id: string
  name: string
  tag: string | null
  function_designation: string | null
  cabinet_type?: string | null
  space_id?: string | null
  space_designation?: string | null
  description: string | null
  component_count?: number
  typical?: { name: string; family: string | null } | null
  nodeWidth?: number
  sourceHandles?: Array<{ id: string; leftPercent: number }>
  targetHandles?: Array<{ id: string; leftPercent: number }>
}

export interface CanvasNode {
  id: string
  type: 'cabinet' | 'fieldComponent' | 'spaceZone'
  position: { x: number; y: number }
  data: CanvasNodeData | SpaceZoneData
  style?: { width?: number; height?: number }
  zIndex?: number
}

export interface CanvasEdge {
  id: string
  source: string
  target: string
  label: string
  data: {
    [key: string]: unknown
    id: string
    label: string | null
    cable_ref: string | null
    cable_type: string | null
    cable_section: number | null
    cable_length: number | null
  }
}

export interface CanvasOverview {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

export interface CanvasPositionUpdate {
  entity_type: string
  entity_id: string
  canvas_type: string
  x: number
  y: number
  width?: number
  height?: number
}
