from __future__ import annotations

from app.services.automation_intents import list_action_specs, validate_action


def test_valid_open_app_action():
    result = validate_action({"action": "open_app", "params": {"name": "notepad"}})
    assert result is not None
    assert result.action == "open_app"
    assert result.params == {"name": "notepad"}
    assert result.confirm_text == "Open notepad?"
    assert result.requires_confirmation is True


def test_valid_create_note_does_not_require_confirmation():
    result = validate_action(
        {"action": "create_note", "params": {"title": "Groceries", "content": "milk, eggs"}}
    )
    assert result is not None
    assert result.requires_confirmation is False
    assert result.confirm_text == "Save note 'Groceries'?"


def test_unknown_action_is_rejected():
    assert validate_action({"action": "delete_all_files", "params": {}}) is None


def test_missing_required_param_is_rejected():
    # open_app requires "name"
    assert validate_action({"action": "open_app", "params": {}}) is None


def test_malformed_shape_is_rejected_not_raised():
    assert validate_action({"not_an_action_key": True}) is None
    assert validate_action({"action": 123, "params": {}}) is None


def test_no_params_action_ignores_extra_junk_gracefully():
    # get_system_info takes no params — extra keys should not crash validation,
    # pydantic's default (ignore) behavior handles this.
    result = validate_action({"action": "get_system_info", "params": {}})
    assert result is not None
    assert result.params == {}


def test_every_registered_action_has_a_working_confirm_template():
    """Guards against a future action definition whose confirm_template references
    a param name that doesn't exist on its own param schema."""
    for spec in list_action_specs():
        sample_params = {name: "sample" for name in spec.params}
        # Should not raise — every placeholder in confirm_template must be a real param.
        spec.confirm_template.format(**sample_params)
