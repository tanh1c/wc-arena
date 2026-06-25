from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


AGENT_SERVICE_ROOT = Path(__file__).resolve().parents[1]
if str(AGENT_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(AGENT_SERVICE_ROOT))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export the current We Speak Football LangGraph diagram.")
    parser.add_argument(
        "--format",
        choices=("mermaid", "png", "ascii", "json"),
        default="mermaid",
        help="Diagram output format. PNG uses LangGraph/LangChain's Mermaid renderer.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=AGENT_SERVICE_ROOT / "docs" / "agent-graph.mmd",
        help="Output file path. Defaults to agent-service/docs/agent-graph.mmd.",
    )
    parser.add_argument(
        "--png-renderer",
        choices=("api", "pyppeteer"),
        default="api",
        help="Renderer for --format png. The api renderer requires network access to Mermaid.INK.",
    )
    return parser.parse_args()


def export_graph(format_name: str, output_path: Path, png_renderer: str) -> Path:
    from app.graph.workflow import build_agent_graph

    graph = build_agent_graph()
    if graph is None:
        raise RuntimeError("LangGraph is not installed, so the agent graph cannot be exported.")

    drawable = graph.get_graph()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if format_name == "mermaid":
        output_path.write_text(drawable.draw_mermaid(), encoding="utf-8")
    elif format_name == "ascii":
        output_path.write_text(drawable.draw_ascii(), encoding="utf-8")
    elif format_name == "json":
        output_path.write_text(json.dumps(drawable.to_json(), indent=2), encoding="utf-8")
    elif format_name == "png":
        from langchain_core.runnables.graph import MermaidDrawMethod

        method = MermaidDrawMethod.API if png_renderer == "api" else MermaidDrawMethod.PYPPETEER
        drawable.draw_mermaid_png(output_file_path=str(output_path), draw_method=method)
    else:
        raise ValueError(f"Unsupported format: {format_name}")

    return output_path


def main() -> None:
    args = parse_args()
    output_path = export_graph(args.format, args.output, args.png_renderer)
    print(f"Exported agent graph diagram to {output_path}")


if __name__ == "__main__":
    main()
