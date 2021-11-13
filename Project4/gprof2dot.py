#!/usr/bin/env python3
#
# Copyright 2008-2017 Jose Fonseca
#
# This program is free software: you can redistribute it and/or modify it
# under the terms of the GNU Lesser General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Lesser General Public License for more details.
#
# You should have received a copy of the GNU Lesser General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
#

"""Generate a dot graph from the output of several profilers."""

__author__ = "Jose Fonseca et al"


import sys
import math
from os.path import basename
import re
import locale
import fnmatch

# Python 2.x/3.x compatibility
if sys.version_info[0] >= 3:
    PYTHON_3 = True
    def compat_iteritems(x): return x.items()  # No iteritems() in Python 3
    def compat_itervalues(x): return x.values()  # No itervalues() in Python 3
    def compat_keys(x): return list(x.keys())  # keys() is a generator in Python 3
    basestring = str  # No class basestring in Python 3
    unichr = chr # No unichr in Python 3
    xrange = range # No xrange in Python 3
else:
    PYTHON_3 = False
    def compat_iteritems(x): return x.iteritems()
    def compat_itervalues(x): return x.itervalues()
    def compat_keys(x): return x.keys()



########################################################################
# Model


MULTIPLICATION_SIGN = unichr(0xd7)


def times(x):
    return "%u%s" % (x, MULTIPLICATION_SIGN)

def percentage(p):
    return "%.02f%%" % (p*100.0,)

def add(a, b):
    return a + b

def fail(a, b):
    assert False


tol = 2 ** -23

def ratio(numerator, denominator):
    try:
        ratio = float(numerator)/float(denominator)
    except ZeroDivisionError:
        # 0/0 is undefined, but 1.0 yields more useful results
        return 1.0
    if ratio < 0.0:
        if ratio < -tol:
            sys.stderr.write('warning: negative ratio (%s/%s)\n' % (numerator, denominator))
        return 0.0
    if ratio > 1.0:
        if ratio > 1.0 + tol:
            sys.stderr.write('warning: ratio greater than one (%s/%s)\n' % (numerator, denominator))
        return 1.0
    return ratio


class UndefinedEvent(Exception):
    """Raised when attempting to get an event which is undefined."""

    def __init__(self, event):
        Exception.__init__(self)
        self.event = event

    def __str__(self):
        return 'unspecified event %s' % self.event.name


class Event(object):
    """Describe a kind of event, and its basic operations."""

    def __init__(self, name, null, aggregator, formatter = str):
        self.name = name
        self._null = null
        self._aggregator = aggregator
        self._formatter = formatter

    def __eq__(self, other):
        return self is other

    def __hash__(self):
        return id(self)

    def null(self):
        return self._null

    def aggregate(self, val1, val2):
        """Aggregate two event values."""
        assert val1 is not None
        assert val2 is not None
        return self._aggregator(val1, val2)

    def format(self, val):
        """Format an event value."""
        assert val is not None
        return self._formatter(val)

    def __repr__(self):
        return f"<gprof2dot.Event '{self.name}'>"


CALLS = Event("Calls", 0, add, times)
SAMPLES = Event("Samples", 0, add, times)
SAMPLES2 = Event("Samples", 0, add, times)

# Count of samples where a given function was either executing or on the stack.
# This is used to calculate the total time ratio according to the
# straightforward method described in Mike Dunlavey's answer to
# stackoverflow.com/questions/1777556/alternatives-to-gprof, item 4 (the myth
# "that recursion is a tricky confusing issue"), last edited 2012-08-30: it's
# just the ratio of TOTAL_SAMPLES over the number of samples in the profile.
#
# Used only when totalMethod == callstacks
TOTAL_SAMPLES = Event("Samples", 0, add, times)

TIME = Event("Time", 0.0, add, lambda x: '(' + str(x) + ')')
TIME_RATIO = Event("Time ratio", 0.0, add, lambda x: '(' + percentage(x) + ')')
TOTAL_TIME = Event("Total time", 0.0, fail)
TOTAL_TIME_RATIO = Event("Total time ratio", 0.0, fail, percentage)

labels = {
    'self-time': TIME,
    'self-time-percentage': TIME_RATIO,
    'total-time': TOTAL_TIME,
    'total-time-percentage': TOTAL_TIME_RATIO,
}
defaultLabelNames = ['total-time-percentage', 'self-time-percentage']

totalMethod = 'callratios'


class Object(object):
    """Base class for all objects in profile which can store events."""

    def __init__(self, events=None):
        if events is None:
            self.events = {}
        else:
            self.events = events

    def __hash__(self):
        return id(self)

    def __eq__(self, other):
        return self is other

    def __lt__(self, other):
        return id(self) < id(other)

    def __contains__(self, event):
        return event in self.events

    def __getitem__(self, event):
        try:
            return self.events[event]
        except KeyError:
            raise UndefinedEvent(event)

    def __setitem__(self, event, value):
        if value is None:
            if event in self.events:
                del self.events[event]
        else:
            self.events[event] = value


class Call(Object):
    """A call between functions.

    There should be at most one call object for every pair of functions.
    """

    def __init__(self, callee_id):
        Object.__init__(self)
        self.callee_id = callee_id
        self.ratio = None
        self.weight = None


class Function(Object):
    """A function."""

    def __init__(self, id, name):
        Object.__init__(self)
        self.id = id
        self.name = name
        self.module = None
        self.process = None
        self.calls = {}
        self.called = None
        self.weight = None
        self.cycle = None
        self.filename = None

    def add_call(self, call):
        if call.callee_id in self.calls:
            sys.stderr.write('warning: overwriting call from function %s to %s\n' % (str(self.id), str(call.callee_id)))
        self.calls[call.callee_id] = call

    def get_call(self, callee_id):
        if not callee_id in self.calls:
            call = Call(callee_id)
            call[SAMPLES] = 0
            call[SAMPLES2] = 0
            call[CALLS] = 0
            self.calls[callee_id] = call
        return self.calls[callee_id]

    _parenthesis_re = re.compile(r'\([^()]*\)')
    _angles_re = re.compile(r'<[^<>]*>')
    _const_re = re.compile(r'\s+const$')

    def stripped_name(self):
        """Remove extraneous information from C++ demangled function names."""

        name = self.name

        # Strip function parameters from name by recursively removing paired parenthesis
        while True:
            old_name = name
            name = self._parenthesis_re.sub('', name)
            if old_name == name:
                break

        # Strip const qualifier
        name = self._const_re.sub('', name)

        # Strip template parameters from name by recursively removing paired angles
        while True:
            old_name = name
            name = self._angles_re.sub('', name)
            if old_name == name:
                break

        return name

    # TODO: write utility functions

    def __repr__(self):
        return self.name

    def dump(self, sep1=",\n\t", sep2=":=", sep3="\n"):
        """ Returns as a string all information available in this Function object
            separators sep1:between entries
                       sep2:between attribute name and value,
                       sep3: inserted at end
        """
        return sep1.join("".join(k,sep2,v) for (k,v) in sorted(self.__dict__.items())) + sep3

class Cycle(Object):
    """A cycle made from recursive function calls."""

    def __init__(self):
        Object.__init__(self)
        self.functions = set()

    def add_function(self, function):
        assert function not in self.functions
        self.functions.add(function)
        if function.cycle is not None:
            for other in function.cycle.functions:
                if function not in self.functions:
                    self.add_function(other)
        function.cycle = self


class Profile(Object):
    """The whole profile."""

    def __init__(self):
        Object.__init__(self)
        self.functions = {}
        self.cycles = []

    def add_function(self, function):
        if function.id in self.functions:
            sys.stderr.write('warning: overwriting function %s (id %s)\n' % (function.name, str(function.id)))
        self.functions[function.id] = function

    def add_cycle(self, cycle):
        self.cycles.append(cycle)

    def validate(self):
        """Validate the edges."""

        for function in compat_itervalues(self.functions):
            for callee_id in compat_keys(function.calls):
                assert function.calls[callee_id].callee_id == callee_id
                if callee_id not in self.functions:
                    sys.stderr.write('warning: call to undefined function %s from function %s\n' % (str(callee_id), function.name))
                    del function.calls[callee_id]

    def find_cycles(self):
        """Find cycles using Tarjan's strongly connected components algorithm."""

        # Apply the Tarjan's algorithm successively until all functions are visited
        stack = []
        data = {}
        order = 0
        for function in compat_itervalues(self.functions):
            order = self._tarjan(function, order, stack, data)
        cycles = []
        for function in compat_itervalues(self.functions):
            if function.cycle is not None and function.cycle not in cycles:
                cycles.append(function.cycle)
        self.cycles = cycles
        if 0:
            for cycle in cycles:
                sys.stderr.write("Cycle:\n")
                for member in cycle.functions:
                    sys.stderr.write("\tFunction %s\n" % member.name)

    def prune_root(self, roots, depth=-1):
        visited = set()
        frontier = set([(root_node, depth) for root_node in roots])
        while len(frontier) > 0:
            node, node_depth = frontier.pop()
            visited.add(node)
            if node_depth == 0:
                continue
            f = self.functions[node]
            newNodes = set(f.calls.keys()) - visited
            frontier = frontier.union({(new_node, node_depth - 1) for new_node in newNodes})
        subtreeFunctions = {}
        for n in visited:
            f = self.functions[n]
            newCalls = {}
            for c in f.calls.keys():
                if c in visited:
                    newCalls[c] = f.calls[c]
            f.calls = newCalls
            subtreeFunctions[n] = f
        self.functions = subtreeFunctions

    def prune_leaf(self, leafs, depth=-1):
        edgesUp = collections.defaultdict(set)
        for f in self.functions.keys():
            for n in self.functions[f].calls.keys():
                edgesUp[n].add(f)
        # build the tree up
        visited = set()
        frontier = set([(leaf_node, depth) for leaf_node in leafs])
        while len(frontier) > 0:
            node, node_depth = frontier.pop()
            visited.add(node)
            if node_depth == 0:
                continue
            newNodes = edgesUp[node] - visited
            frontier = frontier.union({(new_node, node_depth - 1) for new_node in newNodes})
        downTree = set(self.functions.keys())
        upTree = visited
        path = downTree.intersection(upTree)
        pathFunctions = {}
        for n in path:
            f = self.functions[n]
            newCalls = {}
            for c in f.calls.keys():
                if c in path:
                    newCalls[c] = f.calls[c]
            f.calls = newCalls
            pathFunctions[n] = f
        self.functions = pathFunctions

    def getFunctionIds(self, funcName):
        function_names = {v.name: k for (k, v) in self.functions.items()}
        return [function_names[name] for name in fnmatch.filter(function_names.keys(), funcName)]

    def getFunctionId(self, funcName):
        for f in self.functions:
            if self.functions[f].name == funcName:
                return f
        return False

    def printFunctionIds(self, selector=None, file=sys.stderr):
        """ Print to file function entries selected by fnmatch.fnmatch like in
            method getFunctionIds, with following extensions:
             - selector starts with "%": dump all information available
             - selector is '+' or '-': select all function entries
        """
        if selector is None or selector in ("+", "*"):
            v = ",\n".join(("%s:\t%s" % (kf,self.functions[kf].name)
                            for kf in self.functions.keys()))
        else:
            if selector[0]=="%":
                selector=selector[1:]
                function_info={k:v for (k,v)
                               in self.functions.items()
                               if fnmatch.fnmatch(v.name,selector)}
                v = ",\n".join( ("%s\t({k})\t(%s)::\n\t%s" % (v.name,type(v),v.dump())
                                 for (k,v) in function_info.items()
                                  ))

            else:
                function_names = (v.name for v in self.functions.values())
                v = ",\n".join( ( nm for nm in fnmatch.filter(function_names,selector )))

        file.write(v+"\n")
        file.flush()

    class _TarjanData:
        def __init__(self, order):
            self.order = order
            self.lowlink = order
            self.onstack = False

    def _tarjan(self, function, order, stack, data):
        """Tarjan's strongly connected components algorithm.

        See also:
        - http://en.wikipedia.org/wiki/Tarjan's_strongly_connected_components_algorithm
        """

        try:
            func_data = data[function.id]
            return order
        except KeyError:
            func_data = self._TarjanData(order)
            data[function.id] = func_data
        order += 1
        pos = len(stack)
        stack.append(function)
        func_data.onstack = True
        for call in compat_itervalues(function.calls):
            try:
                callee_data = data[call.callee_id]
                if callee_data.onstack:
                    func_data.lowlink = min(func_data.lowlink, callee_data.order)
            except KeyError:
                callee = self.functions[call.callee_id]
                order = self._tarjan(callee, order, stack, data)
                callee_data = data[call.callee_id]
                func_data.lowlink = min(func_data.lowlink, callee_data.lowlink)
        if func_data.lowlink == func_data.order:
            # Strongly connected component found
            members = stack[pos:]
            del stack[pos:]
            if len(members) > 1:
                cycle = Cycle()
                for member in members:
                    cycle.add_function(member)
                    data[member.id].onstack = False
            else:
                for member in members:
                    data[member.id].onstack = False
        return order

    def call_ratios(self, event):
        # Aggregate for incoming calls
        cycle_totals = {}
        for cycle in self.cycles:
            cycle_totals[cycle] = 0.0
        function_totals = {}
        for function in compat_itervalues(self.functions):
            function_totals[function] = 0.0

        # Pass 1:  function_total gets the sum of call[event] for all
        #          incoming arrows.  Same for cycle_total for all arrows
        #          that are coming into the *cycle* but are not part of it.
        for function in compat_itervalues(self.functions):
            for call in compat_itervalues(function.calls):
                if call.callee_id != function.id:
                    callee = self.functions[call.callee_id]
                    if event in call.events:
                        function_totals[callee] += call[event]
                        if callee.cycle is not None and callee.cycle is not function.cycle:
                            cycle_totals[callee.cycle] += call[event]
                    else:
                        sys.stderr.write("call_ratios: No data for " + function.name + " call to " + callee.name + "\n")

        # Pass 2:  Compute the ratios.  Each call[event] is scaled by the
        #          function_total of the callee.  Calls into cycles use the
        #          cycle_total, but not calls within cycles.
        for function in compat_itervalues(self.functions):
            for call in compat_itervalues(function.calls):
                assert call.ratio is None
                if call.callee_id != function.id:
                    callee = self.functions[call.callee_id]
                    if event in call.events:
                        if callee.cycle is not None and callee.cycle is not function.cycle:
                            total = cycle_totals[callee.cycle]
                        else:
                            total = function_totals[callee]
                        call.ratio = ratio(call[event], total)
                    else:
                        # Warnings here would only repeat those issued above.
                        call.ratio = 0.0

    def integrate(self, outevent, inevent):
        """Propagate function time ratio along the function calls.

        Must be called after finding the cycles.

        See also:
        - http://citeseer.ist.psu.edu/graham82gprof.html
        """

        # Sanity checking
        assert outevent not in self
        for function in compat_itervalues(self.functions):
            assert outevent not in function
            assert inevent in function
            for call in compat_itervalues(function.calls):
                assert outevent not in call
                if call.callee_id != function.id:
                    assert call.ratio is not None

        # Aggregate the input for each cycle
        for cycle in self.cycles:
            total = inevent.null()
            for function in compat_itervalues(self.functions):
                total = inevent.aggregate(total, function[inevent])
            self[inevent] = total

        # Integrate along the edges
        total = inevent.null()
        for function in compat_itervalues(self.functions):
            total = inevent.aggregate(total, function[inevent])
            self._integrate_function(function, outevent, inevent)
        self[outevent] = total

    def _integrate_function(self, function, outevent, inevent):
        if function.cycle is not None:
            return self._integrate_cycle(function.cycle, outevent, inevent)
        else:
            if outevent not in function:
                total = function[inevent]
                for call in compat_itervalues(function.calls):
                    if call.callee_id != function.id:
                        total += self._integrate_call(call, outevent, inevent)
                function[outevent] = total
            return function[outevent]

    def _integrate_call(self, call, outevent, inevent):
        assert outevent not in call
        assert call.ratio is not None
        callee = self.functions[call.callee_id]
        subtotal = call.ratio *self._integrate_function(callee, outevent, inevent)
        call[outevent] = subtotal
        return subtotal

    def _integrate_cycle(self, cycle, outevent, inevent):
        if outevent not in cycle:

            # Compute the outevent for the whole cycle
            total = inevent.null()
            for member in cycle.functions:
                subtotal = member[inevent]
                for call in compat_itervalues(member.calls):
                    callee = self.functions[call.callee_id]
                    if callee.cycle is not cycle:
                        subtotal += self._integrate_call(call, outevent, inevent)
                total += subtotal
            cycle[outevent] = total

            # Compute the time propagated to callers of this cycle
            callees = {}
            for function in compat_itervalues(self.functions):
                if function.cycle is not cycle:
                    for call in compat_itervalues(function.calls):
                        callee = self.functions[call.callee_id]
                        if callee.cycle is cycle:
                            try:
                                callees[callee] += call.ratio
                            except KeyError:
                                callees[callee] = call.ratio

            for member in cycle.functions:
                member[outevent] = outevent.null()

            for callee, call_ratio in compat_iteritems(callees):
                ranks = {}
                call_ratios = {}
                partials = {}
                self._rank_cycle_function(cycle, callee, ranks)
                self._call_ratios_cycle(cycle, callee, ranks, call_ratios, set())
                partial = self._integrate_cycle_function(cycle, callee, call_ratio, partials, ranks, call_ratios, outevent, inevent)

                # Ensure `partial == max(partials.values())`, but with round-off tolerance
                max_partial = max(partials.values())
                assert abs(partial - max_partial) <= 1e-7*max_partial

                assert abs(call_ratio*total - partial) <= 0.001*call_ratio*total

        return cycle[outevent]

    def _rank_cycle_function(self, cycle, function, ranks):
        """Dijkstra's shortest paths algorithm.

        See also:
        - http://en.wikipedia.org/wiki/Dijkstra's_algorithm
        """

        import heapq
        Q = []
        Qd = {}
        p = {}
        visited = set([function])

        ranks[function] = 0
        for call in compat_itervalues(function.calls):
            if call.callee_id != function.id:
                callee = self.functions[call.callee_id]
                if callee.cycle is cycle:
                    ranks[callee] = 1
                    item = [ranks[callee], function, callee]
                    heapq.heappush(Q, item)
                    Qd[callee] = item

        while Q:
            cost, parent, member = heapq.heappop(Q)
            if member not in visited:
                p[member]= parent
                visited.add(member)
                for call in compat_itervalues(member.calls):
                    if call.callee_id != member.id:
                        callee = self.functions[call.callee_id]
                        if callee.cycle is cycle:
                            member_rank = ranks[member]
                            rank = ranks.get(callee)
                            if rank is not None:
                                if rank > 1 + member_rank:
                                    rank = 1 + member_rank
                                    ranks[callee] = rank
                                    Qd_callee = Qd[callee]
                                    Qd_callee[0] = rank
                                    Qd_callee[1] = member
                                    heapq._siftdown(Q, 0, Q.index(Qd_callee))
                            else:
                                rank = 1 + member_rank
                                ranks[callee] = rank
                                item = [rank, member, callee]
                                heapq.heappush(Q, item)
                                Qd[callee] = item

    def _call_ratios_cycle(self, cycle, function, ranks, call_ratios, visited):
        if function not in visited:
            visited.add(function)
            for call in compat_itervalues(function.calls):
                if call.callee_id != function.id:
                    callee = self.functions[call.callee_id]
                    if callee.cycle is cycle:
                        if ranks[callee] > ranks[function]:
                            call_ratios[callee] = call_ratios.get(callee, 0.0) + call.ratio
                            self._call_ratios_cycle(cycle, callee, ranks, call_ratios, visited)

    def _integrate_cycle_function(self, cycle, function, partial_ratio, partials, ranks, call_ratios, outevent, inevent):
        if function not in partials:
            partial = partial_ratio*function[inevent]
            for call in compat_itervalues(function.calls):
                if call.callee_id != function.id:
                    callee = self.functions[call.callee_id]
                    if callee.cycle is not cycle:
                        assert outevent in call
                        partial += partial_ratio*call[outevent]
                    else:
                        if ranks[callee] > ranks[function]:
                            callee_partial = self._integrate_cycle_function(cycle, callee, partial_ratio, partials, ranks, call_ratios, outevent, inevent)
                            call_ratio = ratio(call.ratio, call_ratios[callee])
                            call_partial = call_ratio*callee_partial
                            try:
                                call[outevent] += call_partial
                            except UndefinedEvent:
                                call[outevent] = call_partial
                            partial += call_partial
            partials[function] = partial
            try:
                function[outevent] += partial
            except UndefinedEvent:
                function[outevent] = partial
        return partials[function]

    def aggregate(self, event):
        """Aggregate an event for the whole profile."""

        total = event.null()
        for function in compat_itervalues(self.functions):
            try:
                total = event.aggregate(total, function[event])
            except UndefinedEvent:
                return
        self[event] = total

    def ratio(self, outevent, inevent):
        assert outevent not in self
        assert inevent in self
        for function in compat_itervalues(self.functions):
            assert outevent not in function
            assert inevent in function
            function[outevent] = ratio(function[inevent], self[inevent])
            for call in compat_itervalues(function.calls):
                assert outevent not in call
                if inevent in call:
                    call[outevent] = ratio(call[inevent], self[inevent])
        self[outevent] = 1.0

    def prune(self, node_thres, edge_thres, paths, color_nodes_by_selftime):
        """Prune the profile"""

        # compute the prune ratios
        for function in compat_itervalues(self.functions):
            try:
                function.weight = function[TOTAL_TIME_RATIO]
            except UndefinedEvent:
                pass

            for call in compat_itervalues(function.calls):
                callee = self.functions[call.callee_id]

                if TOTAL_TIME_RATIO in call:
                    # handle exact cases first
                    call.weight = call[TOTAL_TIME_RATIO]
                else:
                    try:
                        # make a safe estimate
                        call.weight = min(function[TOTAL_TIME_RATIO], callee[TOTAL_TIME_RATIO])
                    except UndefinedEvent:
                        pass

        # prune the nodes
        for function_id in compat_keys(self.functions):
            function = self.functions[function_id]
            if function.weight is not None:
                if function.weight < node_thres:
                    del self.functions[function_id]

        # prune file paths
        for function_id in compat_keys(self.functions):
            function = self.functions[function_id]
            if paths and function.filename and not any(function.filename.startswith(path) for path in paths):
                del self.functions[function_id]
            elif paths and function.module and not any((function.module.find(path)>-1) for path in paths):
                del self.functions[function_id]

        # prune the edges
        for function in compat_itervalues(self.functions):
            for callee_id in compat_keys(function.calls):
                call = function.calls[callee_id]
                if callee_id not in self.functions or call.weight is not None and call.weight < edge_thres:
                    del function.calls[callee_id]

        if color_nodes_by_selftime:
            weights = []
            for function in compat_itervalues(self.functions):
                try:
                    weights.append(function[TIME_RATIO])
                except UndefinedEvent:
                    pass
            max_ratio = max(weights or [1])

            # apply rescaled weights for coloriung
            for function in compat_itervalues(self.functions):
                try:
                    function.weight = function[TIME_RATIO] / max_ratio
                except (ZeroDivisionError, UndefinedEvent):
                    pass

    def dump(self):
        for function in compat_itervalues(self.functions):
            print('Function %s:' % (function.name,))
            self._dump_events(function.events)
            for call in compat_itervalues(function.calls):
                callee = self.functions[call.callee_id]
                print('  Call %s:' % (callee.name,))
                self._dump_events(call.events)
        for cycle in self.cycles:
            print('Cycle:')
            self._dump_events(cycle.events)
            for function in cycle.functions:
                print('  Function %s' % (function.name,))

    def _dump_events(self, events):
        for event, value in compat_iteritems(events):
            print('    %s: %s' % (event.name, event.format(value)))



########################################################################
# Parsers


class Struct:
    """Masquerade a dictionary with a structure-like behavior."""

    def __init__(self, attrs = None):
        if attrs is None:
            attrs = {}
        self.__dict__['_attrs'] = attrs

    def __getattr__(self, name):
        try:
            return self._attrs[name]
        except KeyError:
            raise AttributeError(name)

    def __setattr__(self, name, value):
        self._attrs[name] = value

    def __str__(self):
        return str(self._attrs)

    def __repr__(self):
        return repr(self._attrs)


class ParseError(Exception):
    """Raised when parsing to signal mismatches."""

    def __init__(self, msg, line):
        Exception.__init__(self)
        self.msg = msg
        # TODO: store more source line information
        self.line = line

    def __str__(self):
        return '%s: %r' % (self.msg, self.line)


class Parser:
    """Parser interface."""

    stdinInput = True
    multipleInput = False

    def __init__(self):
        pass

    def parse(self):
        raise NotImplementedError


class LineParser(Parser):
    """Base class for parsers that read line-based formats."""

    def __init__(self, stream):
        Parser.__init__(self)
        self._stream = stream
        self.__line = None
        self.__eof = False
        self.line_no = 0

    def readline(self):
        line = self._stream.readline()
        if not line:
            self.__line = ''
            self.__eof = True
        else:
            self.line_no += 1
        line = line.rstrip('\r\n')
        if not PYTHON_3:
            encoding = self._stream.encoding
            if encoding is None:
                encoding = locale.getpreferredencoding()
            line = line.decode(encoding)
        self.__line = line

    def lookahead(self):
        assert self.__line is not None
        return self.__line

    def consume(self):
        assert self.__line is not None
        line = self.__line
        self.readline()
        return line

    def eof(self):
        assert self.__line is not None
        return self.__eof


class CallgrindParser(LineParser):
    """Parser for valgrind's callgrind tool.

    See also:
    - http://valgrind.org/docs/manual/cl-format.html
    """

    _call_re = re.compile(r'^calls=\s*(\d+)\s+((\d+|\+\d+|-\d+|\*)\s+)+$')

    def __init__(self, infile):
        LineParser.__init__(self, infile)

        # Textual positions
        self.position_ids = {}
        self.positions = {}

        # Numeric positions
        self.num_positions = 1
        self.cost_positions = ['line']
        self.last_positions = [0]

        # Events
        self.num_events = 0
        self.cost_events = []

        self.profile = Profile()
        self.profile[SAMPLES] = 0

    def parse(self):
        # read lookahead
        self.readline()

        self.parse_key('version')
        self.parse_key('creator')
        while self.parse_part():
            pass
        if not self.eof():
            sys.stderr.write('warning: line %u: unexpected line\n' % self.line_no)
            sys.stderr.write('%s\n' % self.lookahead())

        # compute derived data
        self.profile.validate()
        self.profile.find_cycles()
        self.profile.ratio(TIME_RATIO, SAMPLES)
        self.profile.call_ratios(SAMPLES2)
        self.profile.integrate(TOTAL_TIME_RATIO, TIME_RATIO)

        return self.profile

    def parse_part(self):
        if not self.parse_header_line():
            return False
        while self.parse_header_line():
            pass
        if not self.parse_body_line():
            return False
        while self.parse_body_line():
            pass
        return True

    def parse_header_line(self):
        return \
            self.parse_empty() or \
            self.parse_comment() or \
            self.parse_part_detail() or \
            self.parse_description() or \
            self.parse_event_specification() or \
            self.parse_cost_line_def() or \
            self.parse_cost_summary()

    _detail_keys = set(('cmd', 'pid', 'thread', 'part'))

    def parse_part_detail(self):
        return self.parse_keys(self._detail_keys)

    def parse_description(self):
        return self.parse_key('desc') is not None

    def parse_event_specification(self):
        event = self.parse_key('event')
        if event is None:
            return False
        return True

    def parse_cost_line_def(self):
        pair = self.parse_keys(('events', 'positions'))
        if pair is None:
            return False
        key, value = pair
        items = value.split()
        if key == 'events':
            self.num_events = len(items)
            self.cost_events = items
        if key == 'positions':
            self.num_positions = len(items)
            self.cost_positions = items
            self.last_positions = [0]*self.num_positions
        return True

    def parse_cost_summary(self):
        pair = self.parse_keys(('summary', 'totals'))
        if pair is None:
            return False
        return True

    def parse_body_line(self):
        return \
            self.parse_empty() or \
            self.parse_comment() or \
            self.parse_cost_line() or \
            self.parse_position_spec() or \
            self.parse_association_spec()

    __subpos_re = r'(0x[0-9a-fA-F]+|\d+|\+\d+|-\d+|\*)'
    _cost_re = re.compile(r'^' +
        __subpos_re + r'( +' + __subpos_re + r')*' +
        r'( +\d+)*' +
    '$')

    def parse_cost_line(self, calls=None):
        line = self.lookahead().rstrip()
        mo = self._cost_re.match(line)
        if not mo:
            return False

        function = self.get_function()

        if calls is None:
            # Unlike other aspects, call object (cob) is relative not to the
            # last call object, but to the caller's object (ob), so try to
            # update it when processing a functions cost line
            try:
                self.positions['cob'] = self.positions['ob']
            except KeyError:
                pass

        values = line.split()
        assert len(values) <= self.num_positions + self.num_events

        positions = values[0 : self.num_positions]
        events = values[self.num_positions : ]
        events += ['0']*(self.num_events - len(events))

        for i in range(self.num_positions):
            position = positions[i]
            if position == '*':
                position = self.last_positions[i]
            elif position[0] in '-+':
                position = self.last_positions[i] + int(position)
            elif position.startswith('0x'):
                position = int(position, 16)
            else:
                position = int(position)
            self.last_positions[i] = position

        events = [float(event) for event in events]

        if calls is None:
            function[SAMPLES] += events[0]
            self.profile[SAMPLES] += events[0]
        else:
            callee = self.get_callee()
            callee.called += calls

            try:
                call = function.calls[callee.id]
            except KeyError:
                call = Call(callee.id)
                call[CALLS] = calls
                call[SAMPLES2] = events[0]
                function.add_call(call)
            else:
                call[CALLS] += calls
                call[SAMPLES2] += events[0]

        self.consume()
        return True

    def parse_association_spec(self):
        line = self.lookahead()
        if not line.startswith('calls='):
            return False

        _, values = line.split('=', 1)
        values = values.strip().split()
        calls = int(values[0])
        call_position = values[1:]
        self.consume()

        self.parse_cost_line(calls)

        return True

    _position_re = re.compile(r'^(?P<position>[cj]?(?:ob|fl|fi|fe|fn))=\s*(?:\((?P<id>\d+)\))?(?:\s*(?P<name>.+))?')

    _position_table_map = {
        'ob': 'ob',
        'fl': 'fl',
        'fi': 'fl',
        'fe': 'fl',
        'fn': 'fn',
        'cob': 'ob',
        'cfl': 'fl',
        'cfi': 'fl',
        'cfe': 'fl',
        'cfn': 'fn',
        'jfi': 'fl',
    }

    _position_map = {
        'ob': 'ob',
        'fl': 'fl',
        'fi': 'fl',
        'fe': 'fl',
        'fn': 'fn',
        'cob': 'cob',
        'cfl': 'cfl',
        'cfi': 'cfl',
        'cfe': 'cfl',
        'cfn': 'cfn',
        'jfi': 'jfi',
    }

    def parse_position_spec(self):
        line = self.lookahead()

        if line.startswith('jump=') or line.startswith('jcnd='):
            self.consume()
            return True

        mo = self._position_re.match(line)
        if not mo:
            return False

        position, id, name = mo.groups()
        if id:
            table = self._position_table_map[position]
            if name:
                self.position_ids[(table, id)] = name
            else:
                name = self.position_ids.get((table, id), '')
        self.positions[self._position_map[position]] = name

        self.consume()
        return True

    def parse_empty(self):
        if self.eof():
            return False
        line = self.lookahead()
        if line.strip():
            return False
        self.consume()
        return True

    def parse_comment(self):
        line = self.lookahead()
        if not line.startswith('#'):
            return False
        self.consume()
        return True

    _key_re = re.compile(r'^(\w+):')

    def parse_key(self, key):
        pair = self.parse_keys((key,))
        if not pair:
            return None
        key, value = pair
        return value

    def parse_keys(self, keys):
        line = self.lookahead()
        mo = self._key_re.match(line)
        if not mo:
            return None
        key, value = line.split(':', 1)
        if key not in keys:
            return None
        value = value.strip()
        self.consume()
        return key, value

    def make_function(self, module, filename, name):
        # FIXME: module and filename are not being tracked reliably
        #id = '|'.join((module, filename, name))
        id = name
        try:
            function = self.profile.functions[id]
        except KeyError:
            function = Function(id, name)
            if module:
                function.module = basename(module)
            function[SAMPLES] = 0
            function.called = 0
            self.profile.add_function(function)
        return function

    def get_function(self):
        module = self.positions.get('ob', '')
        filename = self.positions.get('fl', '')
        function = self.positions.get('fn', '')
        return self.make_function(module, filename, function)

    def get_callee(self):
        module = self.positions.get('cob', '')
        filename = self.positions.get('cfi', '')
        function = self.positions.get('cfn', '')
        return self.make_function(module, filename, function)

    def readline(self):
        # Override LineParser.readline to ignore comment lines
        while True:
            LineParser.readline(self)
            if self.eof() or not self.lookahead().startswith('#'):
                break