from browser import console, window, ajax, bind
from dataclasses import dataclass
from gprof2dot import CallgrindParser, TOTAL_TIME_RATIO, TIME_RATIO, UndefinedEvent
from typing import Optional, Union
from io import StringIO

d3 = window.d3

@dataclass
class CustomHierarchy:
    data: FunctionInfo
    depth: int
    height: int
    parent: "CustomHierarchy" = None
    children: list["CustomHierarchy"] = None

    @property
    def value(self) -> float:
        return self.data.total_time_ratio

    def __iter__(self):
        if(self.children is not None):
            for c in self.children:
                yield from c

        yield self

@dataclass
class FunctionInfo:
    name: str
    full_name: str
    time_ratio_all_calls: float = 0
    total_time_ratio: float = 0
    is_cycle: bool = False

def is_visible(xScale, yScale):
    def info(d, i, elem, *_):
        bbox = elem.node().getBBox()
        return (
            bbox.left >= xScale(d.x0)
            and bbox.top >= yScale(d.y0)
            and bbox.right <= xScale(d.x1)
            and bbox.bottom <= yScale(d.y1)
        )

    return info

def new_icicle_chart(selector: str, width: int, height: int, graph: CustomHierarchy):
    xScale = d3.scaleLinear().range([0, width])
    yScale = d3.scaleLinear().range([0, height])

    def d(func):
        return lambda d, *_: func(d)

    svg = (
        d3.select(selector)
        .append("svg").attr("viewBox", f"0 0 {width} {height}")
        .attr("preserveAspectRatio", "xMidYMid meet").attr("class", "chart")
        .append("g").attr("class", "chartArea")
        .attr("font-size", "0.5em")
    )

    g_list = list(graph)

    rects = (
        svg.selectAll("rect").data(g_list).enter().append("rect")
        .attr("x", d(lambda d: xScale(d.x0)))
        .attr("y", d(lambda d: yScale(d.y0)))
        .attr("width", d(lambda d: xScale(d.x1 - d.x0)))
        .attr("height", d(lambda d: yScale(d.y1 - d.y0)))
        .attr("fill", "grey")
        .attr("stroke-width", "2px")
        .attr("stroke", "white")
        .attr("rx", "0.5em")
    )

    text = (
        svg.selectAll("info").data(g_list).enter().append("text")
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("x", d(lambda d: xScale((d.x1 + d.x0) / 2)))
        .attr("y", d(lambda d: yScale((d.y1 + d.y0) / 2)))
        .text(d(lambda d: d.data.name))
        .attr("opacity", is_visible(xScale, yScale))
    )

    print(rects)


def show(text):
    parser = CallgrindParser(StringIO(text))
    profile = parser.parse()

    root_node = build_graph(profile)
    root_node = compute_sizes(root_node, 1, 1 / 7)
    # print("Displaying Chart...")
    new_icicle_chart("#figure1", 800, 300, root_node)

def build_graph(profile, depth_limit = 100) -> CustomHierarchy:
    root = sorted([f for f in profile.functions.values()], key=lambda a: a.events[TOTAL_TIME_RATIO], reverse=True)[0]

    return _build_graph(profile, root, 0, depth_limit)

def _build_graph(profile, func, depth, depth_limit = 100, parent = None, sub_ratio = 1) -> Optional[CustomHierarchy]:
    # Create a new node for ourself...
    data = FunctionInfo(
        func.stripped_name(),
        func.name,
        func.events[TOTAL_TIME_RATIO],
        sub_ratio
    )

    new_node = CustomHierarchy(
        data,
        depth,
        0,
        parent,
        None
    )

    if(len(func.calls) == 0 or depth >= depth_limit):
        return new_node

    new_node.children = []

    for name, callObj in func.calls.items():
        try:
            call_time = callObj[TOTAL_TIME_RATIO]
        except UndefinedEvent:
            # Recursive, TODO: Change...
            call_time = sub_ratio

        new_node.children.append(
            _build_graph(profile, profile.functions[name], depth + 1, depth_limit, new_node, call_time)
        )

    new_node.height = max(c.height for c in new_node.children) + 1

    return new_node

def compute_sizes(graph: CustomHierarchy, width: int, node_depth: int, offset: float = 0) -> CustomHierarchy:
    px0, py0, px1, py1 = (
        (0, 0, width, 0)
        if(graph.parent is None) else
        (graph.parent.x0, graph.parent.y0, graph.parent.x1, graph.parent.y1)
    )

    graph.x0 = px0 + offset
    graph.y0 = py1
    graph.x1 = graph.x0 + (1 if(graph.parent is None) else graph.value / graph.parent.value) * (px1 - px0)
    graph.y1 = py1 + node_depth

    if(graph.children is None):
        return

    offset = 0
    for c in graph.children:
        compute_sizes(c, width, node_depth, offset)
        offset += c.value / graph.value * (graph.x1 - graph.x0)

    return graph


def show_graph(obj, node, depth, depth_limit = 6, ratio = 1):
    if(depth > depth_limit):
        return
    print(("\t" * depth) + node.stripped_name(), ratio, f"{node.events[TIME_RATIO]:.02f}", f"{node.events[TOTAL_TIME_RATIO]:.02f}")
    print("Call EVTs:")
    print(node.cycle)
    for f, c in node.calls.items():
        print(f"Calls {f}: ", c.events)
        print(c[TOTAL_TIME_RATIO])
    print("END!")

    for f, c in node.calls.items():
        show_graph(obj, obj.functions[f], depth + 1, depth_limit, c.ratio)



ajax.get("data/callgrind.out.65715", timeout=7, oncomplete=lambda ret: show(ret.text))


