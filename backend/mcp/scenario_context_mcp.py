@mcp_tool(name="get_scenario_context")
def get_scenario_context(scenario_id: str) -> dict:
    """Retrieve the training scenario context (weather, distance to port, resources)."""
    return scenario_db.get(scenario_id, {
        "sea_state": "unknown",
        "hours_to_nearest_port": None,
        "medevac_available": False,
        "on_board_resources": []
    })