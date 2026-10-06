"""Pydantic shapes for Tracker insight API responses."""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class SummaryCard(BaseModel):
    title: str
    value: Any
    trend_pct: float = 0
    progress_pct: float = 0
    last_updated: Optional[str] = None
    icon: Optional[str] = None


class KpiCard(BaseModel):
    model_config = ConfigDict(extra="allow")

    title: str
    value: Any
    value_number: Optional[str] = None
    value_unit: Optional[str] = None
    trend_pct: float = 0
    weeks: list[float] = Field(default_factory=list)
    bar_heights: list[int] = Field(default_factory=list)
    progress_pct: float = 0
    due_date: Optional[str] = None
    mentor_remarks: Optional[str] = None
    icon_tone: Optional[str] = None
    icon: Optional[str] = None


class PerformanceAnalysisRow(BaseModel):
    skill: str
    score: int
    global_avg: int
    trend: Literal["up", "down"] = "up"
    trend_pct: float = 0
    narrative: str = ""
    vs_global: Optional[float] = None


class BenchmarkPanelItem(BaseModel):
    label: str
    score: int
    insight: str = ""


class BenchmarkPanel(BaseModel):
    items: list[BenchmarkPanelItem] = Field(default_factory=list)


class ActivityReminders(BaseModel):
    upcoming_meetings: int = 0
    pending_activities: int = 0
    message: str = ""
    cta_label: str = "Set Reminders"


class MeetingWidgets(BaseModel):
    upcoming: int = 0
    completed: int = 0
    cancelled: int = 0
    reminder_text: str = ""
    event_dates: list[str] = Field(default_factory=list)


class ChartBlock(BaseModel):
    model_config = ConfigDict(extra="allow")

    subtitle: Optional[str] = None


class ActivityCard(BaseModel):
    model_config = ConfigDict(extra="allow")

    title: str = ""
    description: Optional[str] = None
    status: Optional[str] = None
    term: Optional[str] = None
    term_tag: Optional[str] = None
    status_tag: Optional[str] = None
    priority: Optional[str] = None
    progress_pct: float = 0
    due_date: Optional[str] = None
    mentor_remarks: Optional[str] = None
    icon: Optional[str] = None


class TrackerDashboardPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    generated_at: str
    reports_as_of: str
    welcome_name: str
    summary_cards: list[SummaryCard] = Field(default_factory=list)
    kpis: list[KpiCard] = Field(default_factory=list)
    global_benchmark: dict[str, Any] = Field(default_factory=dict)
    learning_pathway: dict[str, Any] = Field(default_factory=dict)
    charts: dict[str, Any] = Field(default_factory=dict)
    recent_activities: list[ActivityCard] = Field(default_factory=list)
    meeting_widgets: MeetingWidgets = Field(default_factory=MeetingWidgets)
    performance_analysis: list[PerformanceAnalysisRow] = Field(default_factory=list)
    skills_overview: list[dict[str, Any]] = Field(default_factory=list)
    activity_reminders: ActivityReminders = Field(default_factory=ActivityReminders)


class TrackerProfilePayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    tab: str
    generated_at: str
    student: dict[str, Any] = Field(default_factory=dict)


class TrackerAnalysisPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    tab: str
    generated_at: str


TrackerDashboardPayload.model_rebuild()
TrackerProfilePayload.model_rebuild()
TrackerAnalysisPayload.model_rebuild()
