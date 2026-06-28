from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, DeclarativeBase


class Base(DeclarativeBase):
    pass


class Project(Base):
    __tablename__ = "projects"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String, nullable=False)
    description = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cabinets = relationship("Cabinet", back_populates="project", cascade="all, delete-orphan")
    field_components = relationship("FieldComponent", back_populates="project", cascade="all, delete-orphan")
    connections = relationship("Connection", back_populates="project", cascade="all, delete-orphan")
    spaces = relationship("Space", back_populates="project", cascade="all, delete-orphan")


class ComponentTypical(Base):
    __tablename__ = "component_typicals"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String, nullable=False)
    code = Column(String, nullable=False, unique=True)
    family = Column(String)
    symbol = Column(String)
    description = Column(String)
    etim_class_id = Column(String)
    etim_class_desc = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class Space(Base):
    __tablename__ = "spaces"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("spaces.id", ondelete="CASCADE"), nullable=True)
    name = Column(String, nullable=False)
    designation = Column(String)
    level_type = Column(String)  # gebouw, verdieping, ruimte, zone
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="spaces")
    parent = relationship("Space", back_populates="children", remote_side=[id])
    children = relationship("Space", back_populates="parent", cascade="all, delete-orphan")
    cabinets = relationship("Cabinet", back_populates="space")
    field_components = relationship("FieldComponent", back_populates="space")


class Cabinet(Base):
    __tablename__ = "cabinets"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    space_id = Column(UUID(as_uuid=True), ForeignKey("spaces.id", ondelete="SET NULL"), nullable=True)
    name = Column(String, nullable=False)
    tag = Column(String)
    function_designation = Column(String)
    cabinet_type = Column(String)  # hoofdverdeler, onderverdeler, besturingskast, netwerkkast, klemmenkast
    description = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="cabinets")
    space = relationship("Space", back_populates="cabinets")
    components = relationship("Component", back_populates="cabinet", cascade="all, delete-orphan")


class Component(Base):
    __tablename__ = "components"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    cabinet_id = Column(UUID(as_uuid=True), ForeignKey("cabinets.id", ondelete="CASCADE"), nullable=False)
    typical_id = Column(UUID(as_uuid=True), ForeignKey("component_typicals.id", ondelete="SET NULL"), nullable=True)
    name = Column(String, nullable=False)
    tag = Column(String)
    position_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cabinet = relationship("Cabinet", back_populates="components")
    typical = relationship("ComponentTypical")
    tests = relationship(
        "ElectricalTest",
        back_populates="component",
        cascade="all, delete-orphan",
        foreign_keys="ElectricalTest.component_id",
    )


class FieldComponent(Base):
    __tablename__ = "field_components"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    space_id = Column(UUID(as_uuid=True), ForeignKey("spaces.id", ondelete="SET NULL"), nullable=True)
    typical_id = Column(UUID(as_uuid=True), ForeignKey("component_typicals.id", ondelete="SET NULL"), nullable=True)
    name = Column(String, nullable=False)
    tag = Column(String)
    function_designation = Column(String)
    description = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="field_components")
    space = relationship("Space", back_populates="field_components")
    typical = relationship("ComponentTypical")
    tests = relationship(
        "ElectricalTest",
        back_populates="field_component",
        cascade="all, delete-orphan",
        foreign_keys="ElectricalTest.field_component_id",
    )


class ElectricalTest(Base):
    __tablename__ = "electrical_tests"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    component_id = Column(UUID(as_uuid=True), ForeignKey("components.id", ondelete="CASCADE"), nullable=True)
    field_component_id = Column(UUID(as_uuid=True), ForeignKey("field_components.id", ondelete="CASCADE"), nullable=True)
    name = Column(String, nullable=False)
    test_type = Column(String, nullable=False)
    expected_value = Column(String)
    unit = Column(String)
    actual_value = Column(String)
    status = Column(String, default="pending")
    notes = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    component = relationship("Component", back_populates="tests", foreign_keys=[component_id])
    field_component = relationship("FieldComponent", back_populates="tests", foreign_keys=[field_component_id])


class Connection(Base):
    __tablename__ = "connections"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    source_type = Column(String, nullable=False)
    source_id = Column(UUID(as_uuid=True), nullable=False)
    target_type = Column(String, nullable=False)
    target_id = Column(UUID(as_uuid=True), nullable=False)
    label = Column(String)
    cable_ref = Column(String)
    cable_type = Column(String)
    cable_section = Column(Float)
    cable_length = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="connections")


class CanvasPosition(Base):
    __tablename__ = "canvas_positions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    entity_type = Column(String, nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    canvas_type = Column(String, nullable=False)
    x = Column(Float, default=0.0)
    y = Column(Float, default=0.0)
    width = Column(Float)
    height = Column(Float)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("entity_id", "canvas_type", name="uq_canvas_position"),
    )
