"""Request validation for projects/sprints (no DB). Run: python -m pytest test_models.py -v"""
import pytest
from pydantic import ValidationError

from fastapi_app import ProjectCreate, SprintCreate


def test_past_dates_allowed_for_historical_projects():
    p = ProjectCreate(project_name="Old", start_date="2024-01-01", end_date="2024-06-30")
    assert p.end_date == "2024-06-30"


@pytest.mark.parametrize("body,message", [
    ({"project_name": "x", "start_date": "2026-10-01", "end_date": "2026-09-01"}, "End date cannot be before"),
    ({"project_name": "x", "start_date": "01/10/2026"}, "YYYY-MM-DD"),
    ({"project_name": "x", "total_budget": -1}, "greater than or equal to 0"),
    ({"project_name": "   "}, "Project name is required"),
])
def test_invalid_projects_rejected_with_clear_message(body, message):
    with pytest.raises(ValidationError) as e:
        ProjectCreate(**body)
    assert message in str(e.value)


def test_blank_fields_become_defaults():
    p = ProjectCreate(project_name=" Site ", total_budget=None, start_date="", end_date="")
    assert (p.project_name, p.total_budget, p.start_date, p.end_date) == ("Site", 0, None, None)
    s = SprintCreate(project_id=1, sprint_no=1, start_date="", planned_value=None)
    assert s.start_date is None and s.planned_value == 0
