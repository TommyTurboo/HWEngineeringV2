from __future__ import annotations
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class ProjectRead(BaseModel):
    id: UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TypicalCreate(BaseModel):
    name: str
    code: str
    family: str | None = None
    symbol: str | None = None
    description: str | None = None
    etim_class_id: str | None = None
    etim_class_desc: str | None = None


class TypicalRead(BaseModel):
    id: UUID
    name: str
    code: str
    family: str | None
    symbol: str | None
    description: str | None
    etim_class_id: str | None
    etim_class_desc: str | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SpaceCreate(BaseModel):
    name: str
    parent_id: UUID | None = None
    designation: str | None = None
    level_type: str | None = None  # gebouw, verdieping, ruimte, zone


class SpaceUpdate(BaseModel):
    name: str | None = None
    designation: str | None = None
    level_type: str | None = None


class SpaceRead(BaseModel):
    id: UUID
    project_id: UUID
    parent_id: UUID | None
    name: str
    designation: str | None
    level_type: str | None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SpaceTree(SpaceRead):
    children: list[SpaceTree] = []


SpaceTree.model_rebuild()


class CabinetCreate(BaseModel):
    name: str
    cabinet_type: str
    description: str | None = None
    space_id: UUID | None = None
    function_designation: str | None = None


class CabinetUpdate(BaseModel):
    name: str | None = None
    cabinet_type: str | None = None
    description: str | None = None
    space_id: UUID | None = None
    function_designation: str | None = None


class CabinetRead(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    tag: str | None
    cabinet_type: str | None
    space_id: UUID | None
    function_designation: str | None
    description: str | None
    component_count: int = 0
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ComponentCreate(BaseModel):
    name: str
    tag: str | None = None
    typical_id: UUID | None = None
    position_order: int = 0


class ComponentUpdate(BaseModel):
    name: str | None = None
    tag: str | None = None
    typical_id: UUID | None = None
    position_order: int | None = None


class ComponentRead(BaseModel):
    id: UUID
    cabinet_id: UUID
    name: str
    tag: str | None
    position_order: int
    typical: TypicalRead | None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class FieldComponentCreate(BaseModel):
    name: str
    tag: str | None = None
    typical_id: UUID | None = None
    description: str | None = None
    space_id: UUID | None = None
    function_designation: str | None = None


class FieldComponentUpdate(BaseModel):
    name: str | None = None
    tag: str | None = None
    typical_id: UUID | None = None
    description: str | None = None
    space_id: UUID | None = None
    function_designation: str | None = None


class FieldComponentRead(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    tag: str | None
    function_designation: str | None
    description: str | None
    space_id: UUID | None
    typical: TypicalRead | None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TestCreate(BaseModel):
    name: str
    test_type: str
    component_id: UUID | None = None
    field_component_id: UUID | None = None
    expected_value: str | None = None
    unit: str | None = None
    notes: str | None = None


class TestUpdate(BaseModel):
    name: str | None = None
    test_type: str | None = None
    expected_value: str | None = None
    unit: str | None = None
    actual_value: str | None = None
    status: str | None = None
    notes: str | None = None


class TestRead(BaseModel):
    id: UUID
    component_id: UUID | None
    field_component_id: UUID | None
    name: str
    test_type: str
    expected_value: str | None
    unit: str | None
    actual_value: str | None
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ConnectionCreate(BaseModel):
    source_type: str
    source_id: UUID
    target_type: str
    target_id: UUID
    label: str | None = None
    cable_ref: str | None = None
    cable_type: str | None = None
    cable_section: float | None = None
    cable_length: float | None = None


class ConnectionUpdate(BaseModel):
    label: str | None = None
    cable_ref: str | None = None
    cable_type: str | None = None
    cable_section: float | None = None
    cable_length: float | None = None


class ConnectionRead(BaseModel):
    id: UUID
    project_id: UUID
    source_type: str
    source_id: UUID
    target_type: str
    target_id: UUID
    label: str | None
    cable_ref: str | None
    cable_type: str | None
    cable_section: float | None
    cable_length: float | None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CanvasPositionUpdate(BaseModel):
    entity_type: str
    entity_id: UUID
    canvas_type: str
    x: float
    y: float
    width: float | None = None
    height: float | None = None
