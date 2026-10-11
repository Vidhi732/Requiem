import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

# Topological road network graph representing high-volume connected corridors
PROPAGATION_GRAPH = {
    "nodes": [
        {
            "id": "blr_silk_board",
            "name": "Silk Board Junction",
            "lat": 12.9176,
            "lon": 77.6238,
            "capacity_vph": 6500,
            "base_delay_min": 18,
            "corridor": "Hosur / Outer Ring Road"
        },
        {
            "id": "blr_hsr_layout",
            "name": "HSR Layout Ring Road",
            "lat": 12.9116,
            "lon": 77.6389,
            "capacity_vph": 5200,
            "base_delay_min": 10,
            "corridor": "Outer Ring Road South"
        },
        {
            "id": "blr_sony_world",
            "name": "Sony World (Koramangala)",
            "lat": 12.9345,
            "lon": 77.6265,
            "capacity_vph": 4800,
            "base_delay_min": 12,
            "corridor": "80 Feet Road"
        },
        {
            "id": "blr_orr_bellandur",
            "name": "Outer Ring Road (Bellandur)",
            "lat": 12.9304,
            "lon": 77.6784,
            "capacity_vph": 7200,
            "base_delay_min": 15,
            "corridor": "Tech Corridor ORR"
        },
        {
            "id": "blr_sarjapur_rd",
            "name": "Sarjapur Road Junction",
            "lat": 12.9237,
            "lon": 77.6534,
            "capacity_vph": 4500,
            "base_delay_min": 14,
            "corridor": "Sarjapur Feeder"
        },
        {
            "id": "blr_marathahalli",
            "name": "Marathahalli Bridge",
            "lat": 12.9562,
            "lon": 77.7011,
            "capacity_vph": 6000,
            "base_delay_min": 16,
            "corridor": "Airport / Varthur Junction"
        }
    ],
    "edges": [
        {"from": "blr_silk_board", "to": "blr_hsr_layout", "distance_km": 2.1, "coupling_strength": 0.88},
        {"from": "blr_silk_board", "to": "blr_sony_world", "distance_km": 2.4, "coupling_strength": 0.82},
        {"from": "blr_hsr_layout", "to": "blr_sarjapur_rd", "distance_km": 2.7, "coupling_strength": 0.75},
        {"from": "blr_sarjapur_rd", "to": "blr_orr_bellandur", "distance_km": 3.2, "coupling_strength": 0.85},
        {"from": "blr_sony_world", "to": "blr_sarjapur_rd", "distance_km": 3.8, "coupling_strength": 0.65},
        {"from": "blr_orr_bellandur", "to": "blr_marathahalli", "distance_km": 4.5, "coupling_strength": 0.90},
    ]
}


def simulate_cascade_propagation(
    epicenter_node_id: str = "blr_silk_board",
    incident_severity: float = 0.80  # 0.1 to 1.0 (1.0 = complete gridlock)
) -> Dict[str, Any]:
    """
    Simulates shockwave cascade propagation across coupled road network nodes.
    Uses transparent graph diffusion rule:
    Downstream Risk = Severity * Coupling * exp(-0.15 * distance_km)
    """
    nodes = {n["id"]: dict(n) for n in PROPAGATION_GRAPH["nodes"]}
    edges = PROPAGATION_GRAPH["edges"]

    if epicenter_node_id not in nodes:
        epicenter_node_id = "blr_silk_board"

    # Initialize nodes state
    for n in nodes.values():
        n["is_epicenter"] = (n["id"] == epicenter_node_id)
        n["simulated_risk_score"] = round(incident_severity * 100, 1) if n["is_epicenter"] else 0.0
        n["downstream_hop"] = 0 if n["is_epicenter"] else -1
        n["estimated_added_delay_min"] = round(incident_severity * n["base_delay_min"] * 1.5, 1) if n["is_epicenter"] else 0.0
        n["propagation_status"] = "Epicenter (Origin Shock)" if n["is_epicenter"] else "Normal Baseline"

    # Breadth-first / edge-based diffusion
    impacted_nodes = [epicenter_node_id]
    visited = {epicenter_node_id}
    queue = [(epicenter_node_id, incident_severity, 1)]

    propagation_steps = [
        {
            "step": 0,
            "relative_time": "T + 0 min",
            "node_id": epicenter_node_id,
            "node_name": nodes[epicenter_node_id]["name"],
            "event": f"Initial shock at {nodes[epicenter_node_id]['name']} (Severity: {int(incident_severity * 100)}%)",
            "affected_risk": round(incident_severity * 100, 1),
        }
    ]

    time_step = 1
    while queue:
        curr_id, curr_severity, hop = queue.pop(0)
        # Find all outgoing and connected edges
        for edge in edges:
            neighbor = None
            if edge["from"] == curr_id and edge["to"] not in visited:
                neighbor = edge["to"]
            elif edge["to"] == curr_id and edge["from"] not in visited:
                neighbor = edge["from"]

            if neighbor and neighbor not in visited:
                dist = edge["distance_km"]
                coupling = edge["coupling_strength"]
                # Transparent physical attenuation rule
                propagated_risk = curr_severity * coupling * (2.71828 ** (-0.18 * dist))
                propagated_risk = max(0.05, min(0.95, propagated_risk))

                nodes[neighbor]["simulated_risk_score"] = round(propagated_risk * 100, 1)
                nodes[neighbor]["downstream_hop"] = hop
                nodes[neighbor]["estimated_added_delay_min"] = round(propagated_risk * nodes[neighbor]["base_delay_min"], 1)
                nodes[neighbor]["propagation_status"] = f"Hop {hop} Downstream Spillover"

                visited.add(neighbor)
                queue.append((neighbor, propagated_risk, hop + 1))

                propagation_steps.append({
                    "step": time_step,
                    "relative_time": f"T + {hop * 12} min",
                    "node_id": neighbor,
                    "node_name": nodes[neighbor]["name"],
                    "event": f"Cascade spillover arrives at {nodes[neighbor]['name']} from {nodes[curr_id]['name']}",
                    "affected_risk": round(propagated_risk * 100, 1),
                })
                time_step += 1

    return {
        "epicenter": epicenter_node_id,
        "epicenter_name": nodes[epicenter_node_id]["name"],
        "incident_severity": incident_severity,
        "simulation_disclaimer": (
            "Simulated cascade delay propagation model. Represents theoretical traffic "
            "queue spillover through coupled road network connections. Not validated "
            "against real micro-sensor queue time observations."
        ),
        "nodes": list(nodes.values()),
        "edges": edges,
        "timeline": propagation_steps,
    }
