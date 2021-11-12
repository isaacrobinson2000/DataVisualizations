from browser import console, window, ajax, bind
from gprof2dot import CallgrindParser
from io import StringIO

d3 = window.d3

def show(req):
    parser = CallgrindParser(StringIO(req.text))
    graph = parser.parse()

    print([(type(k), v.called) for k, v in graph.functions.items()])
    print(graph.cycles)
    print(graph.events)

ajax.get("data/callgrind.out.65715", timeout=7, oncomplete=show)


