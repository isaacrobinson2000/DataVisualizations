from browser import console, window, ajax, bind
from dataclasses import dataclass
from gprof2dot import CallgrindParser, TOTAL_TIME_RATIO, TIME_RATIO, UndefinedEvent
from typing import Optional, Union
from io import StringIO

d3 = window.d3
Promise = window.Promise

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

    def __str__(self) -> str:
        return (
            f"Full Name: {self.full_name}<br>"
            f"Time Spent: {self.total_time_ratio * 100:.02f}%<br>"
            f"Time Spent All Calls: {self.time_ratio_all_calls * 100:.02f}%<br>"
        )


def is_visible(xScale, yScale):
    def info(d, i, elem, *_):
        bbox = elem[0].getBBox()
        return int(
            bbox.width <= xScale(d.x1) - xScale(d.x0)
            and bbox.height <= yScale(d.y1) - yScale(d.y0)
        )

    return info


def new_icicle_chart(selector: str, width: int, height: int, graph: CustomHierarchy):
    xScale = d3.scaleLinear().range([0, width])
    yScale = d3.scaleLinear().range([0, height])

    def colormap(value):
        return d3.interpolateYlOrRd(0.2 + value * 0.65)

    def d(func):
        return lambda d, *_: func(d)

    file_upload = d3.select(selector).append("input").attr("type", "file").attr("class", "file-upload")
    info_area = d3.select(selector).append("p").attr("class", "error-info").style("display", "none")
    tooltip = d3.select("#tooltip")

    svg = (
        d3.select(selector)
        .append("svg").attr("viewBox", f"0 0 {width} {height}")
        .attr("preserveAspectRatio", "xMidYMid meet").attr("class", "chart")
        .append("g").attr("class", "chartArea")
        .attr("font-size", "10px")
    )

    g_list = list(graph)

    rects = (
        svg.selectAll("rect").data(g_list).enter().append("rect")
        .attr("x", d(lambda d: xScale(d.x0)))
        .attr("y", d(lambda d: yScale(d.y0)))
        .attr("width", d(lambda d: xScale(d.x1) - xScale(d.x0)))
        .attr("height", d(lambda d: yScale(d.y1) - yScale(d.y0)))
        .attr("fill", d(lambda d: "lightgrey" if(d.parent is None) else colormap(d.value)))
        .attr("stroke-width", "1px")
        .attr("stroke", "white")
        .attr("rx", "0.5em")
    )

    text = (
        svg.selectAll("info").data(g_list).enter().append("text")
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("x", d(lambda d: (xScale(d.x1) + xScale(d.x0)) / 2))
        .attr("y", d(lambda d: (yScale(d.y1) + yScale(d.y0)) / 2))
        .text(d(lambda d: f"{d.data.name} ({d.value * 100:.02f}%)"))
        .attr("opacity", is_visible(xScale, yScale))
        .style("pointer-events", "none")
    )

    def on_click(evt, data, *_):
        xScale.domain([data.x0, data.x1])
        yScale.domain([data.y0, data.y0 + 1]).range([0 if(data.parent is None) else 10, height])

        p1 = (
            rects.transition()
            .delay(500)
            .duration(2000)
            .attr("x", d(lambda d: xScale(d.x0)))
            .attr("y", d(lambda d: yScale(d.y0)))
            .attr("width", d(lambda d: xScale(d.x1) - xScale(d.x0)))
            .attr("height", d(lambda d: yScale(d.y1) - yScale(d.y0)))
        ).end()

        p2 = (
            text
            .transition()
            .delay(500)
            .duration(2000)
            .attr("x", d(lambda d: (xScale(d.x1) + xScale(d.x0)) / 2))
            .attr("y", d(lambda d: (yScale(d.y1) + yScale(d.y0)) / 2))
        ).end()

        Promise.all([p1, p2]).then(lambda res: text.attr("opacity", is_visible(xScale, yScale)))

    def mouseon(evt, data, *_):
        tooltip.style("display", "inline")

    def mousemove(evt, data, *_):
        tooltip.html(str(data.data))
        tooltip.style("left", f"{evt.clientX}px").style("top", f"{(evt.clientY - 10)}px")

    def mouseoff(evt, data, *_):
        tooltip.style("display", "none")

    def on_upload(evt, data, *_):
        nonlocal rects
        nonlocal text
        nonlocal svg

        reader = window.eval("new FileReader()")

        def on_load(*_):
            nonlocal rects
            nonlocal text
            nonlocal svg

            xScale.range([0, width]).domain([0, 1])
            yScale.range([0, height]).domain([0, 1])

            try:
                new_p = CallgrindParser(StringIO(reader.result))
                profile = new_p.parse()
                g = build_graph(profile)
                g = compute_sizes(g, 1, 1 / 7)
                g_list = list(g)

                rects.remove()
                text.remove()

                rects = (
                    svg.selectAll("rect").data(g_list).enter().append("rect")
                    .attr("x", d(lambda d: xScale(d.x0)))
                    .attr("y", d(lambda d: yScale(d.y0)))
                    .attr("width", d(lambda d: xScale(d.x1) - xScale(d.x0)))
                    .attr("height", d(lambda d: yScale(d.y1) - yScale(d.y0)))
                    .attr("fill", d(lambda d: "lightgrey" if(d.parent is None) else colormap(d.value)))
                    .attr("stroke-width", "1px")
                    .attr("stroke", "white")
                    .attr("rx", "0.5em")
                )

                text = (
                    svg.selectAll("info").data(g_list).enter().append("text")
                    .attr("text-anchor", "middle")
                    .attr("alignment-baseline", "middle")
                    .attr("x", d(lambda d: (xScale(d.x1) + xScale(d.x0)) / 2))
                    .attr("y", d(lambda d: (yScale(d.y1) + yScale(d.y0)) / 2))
                    .text(d(lambda d: f"{d.data.name} ({d.value * 100:.02f}%)"))
                    .attr("opacity", is_visible(xScale, yScale))
                    .style("pointer-events", "none")
                )

                rects.on("click", on_click).on("mouseover", mouseon).on("mousemove", mousemove).on("mouseleave", mouseoff)
            except Exception as e:
                info_area.style("display", "block").text(f"Error occured on update: {e}")
                raise e

        reader.onload = on_load
        reader.readAsText(evt.target.files[0])

    file_upload.on("change", on_upload)
    rects.on("click", on_click).on("mouseover", mouseon).on("mousemove", mousemove).on("mouseleave", mouseoff)


def show(text1, text2):
    for selector, text in zip(["#figure1", "#figure2"], [text1, text2]):
        parser = CallgrindParser(StringIO(text))
        profile = parser.parse()
        root_node = build_graph(profile)
        root_node = compute_sizes(root_node, 1, 1 / 7)
        new_icicle_chart(selector, 900, 200, root_node)


    d3.selectAll(".loading").style("display", "none")


def build_graph(profile, depth_limit = 20) -> CustomHierarchy:
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

    sub_ratio_calls = 0

    for name, callObj in func.calls.items():
        try:
            call_time = callObj[TOTAL_TIME_RATIO]
        except UndefinedEvent:
            # Recursive, TODO: Change...
            call_time = sub_ratio * (sub_ratio / (1 if(parent is None or parent.value == 0) else parent.value))

        sub_ratio_calls += call_time

    correction_mult = 1 if(sub_ratio_calls <= sub_ratio) else sub_ratio / sub_ratio_calls

    for name, callObj in func.calls.items():
        try:
            call_time = callObj[TOTAL_TIME_RATIO] * correction_mult
        except UndefinedEvent:
            # Recursive, TODO: Change...
            call_time = sub_ratio * (sub_ratio / (1 if(parent is None or parent.value == 0) else parent.value)) * correction_mult

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
    if(graph.parent is not None and graph.parent.value == 0):
        graph.x1 = graph.x0
    else:
        if(graph.parent is not None):
            graph.x1 = graph.x0 + (graph.value / graph.parent.value) * (px1 - px0)
        else:
            graph.x1 = graph.x0 + 1
    graph.y1 = py1 + node_depth

    if(graph.children is None):
        return

    sub_offset = 0

    for i, c in enumerate(graph.children):
        compute_sizes(c, width, node_depth, sub_offset)
        sub_offset = c.x1 - graph.x0

    return graph


def show_graph(obj, node, depth, depth_limit = 9, ratio = 1):
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


with open("data/callgrind.out.134422.switchsize2") as a:
    with open("data/callgrind.out.134671.switchsize128") as b:
        print("Running...")
        show(a.read(), b.read())
