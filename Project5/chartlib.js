"use strict";

function buildMapper(data, attrs, colors, domainMapper = numericDomain) {
    // Builds a 'ColorMap' object, function with some extra attributes...
    let vals = domainMapper([data], [attrs]);

    if(domainMapper.listing) {
        // Convert to dictionary for key => integer...
        let valToNum = {};
        for(let i = 0; i < vals.length; i++) valToNum[vals[i]] = i;

        let mapper = function(value) {
            return colors[valToNum[value]];
        }

        mapper.listing = true;
        mapper.keyList = vals;
        mapper.keyToInteger = valToNum;
        mapper.colorList = colors;

        return mapper;
    }
    else {
        let [min, max] = vals;

        let mapper = function(value) {
            let norm_color = (value - min) / (max - min);
            let no_correct_idx = Math.floor(norm_color * colors.length);
            return colors[no_correct_idx - Math.floor(no_correct_idx / colors.length)];
        }

        mapper.listing = false;
        mapper.range = vals;
        mapper.colorList = colors;

        return mapper;
    }
}

function getCMapLabels(colorMap, topLabel = null, reverse = false) {
    let vals = [];
    let colors = [];

    // This is a numeric/ordinal colormap...
    if(colorMap.listing) {
        for(let i = 0; i < colorMap.keyList.length; i++) {
            vals[i] = colorMap.keyList[i];
            colors[i] = colorMap.colorList[i];
        }
    }
    else {
        let [min, max] = colorMap.range;

        let clean = (n) => Math.round(n * 10) / 10;

        for(let i = 0; i < colorMap.colorList.length; i++) {
            vals[i] = clean((((i / colorMap.colorList.length) * (max - min)) + min));
            colors[i] = colorMap.colorList[i];
        }
    }

    if(reverse) {
        colors.reverse();
        vals.reverse();
    }

    return {
        labels: (topLabel !== null)? [topLabel, ...vals.reverse()]: vals.reverse(),
        colorLabels: (topLabel !== null)? [...colors, "transparent"].reverse(): colors.reverse()
    };
}

// Some domain, or bound functions...
function numericDomain(dataList, attrs) {
    if(typeof(attrs) == "string") {
        attrs = Array(dataList.length).fill(attrs);
    }

    let minVal = d3.min(dataList.map((data, i) => d3.min(data.map((entry) => entry[attrs[i]]))));
    let maxVal = d3.max(dataList.map((data, i) => d3.max(data.map((entry) => entry[attrs[i]]))));

    return [minVal, maxVal]
}

function ordinalDomain(sortFunc = undefined) {
    let res = (dataList, attrs) => {
        return categoryDomain(dataList, attrs, true, sortFunc);
    }
    res.listing = true;
    return res;
}

function categoryDomain(dataList, attrs, _sortItems = false, _sortFunc = undefined) {
    if(typeof(attrs) == "string") {
        attrs = Array(dataList.length).fill(attrs);
    }

    let symbolSet = new Set();
    let i = 0;

    for(let data of dataList) {
        for(let elem of data) {
            symbolSet.add(elem[attrs[i]]);
        }
        i++;
    }

    let finalArr = Array.from(symbolSet);
    if(_sortItems) return finalArr.sort(_sortFunc);

    return finalArr;
}
// Tells methods these list all possible values rather then a range...
categoryDomain.listing = true;
numericDomain.listing = false;

function getPaddedDomain(padding = 1) {
    let func = (d, lbl) => {
        let [b, t] = numericDomain(d, lbl);
        let sign = Math.sign(t - b);
        return [b - sign * padding, t + sign * padding];
    }
    func.listing = false;
    return func;
}

function getRawDomain(arr) {
    let func = (a, b) => arr;
    func.listing = false;
    return func;
}

function parseLegendLocation(legendLocation) {
    let vals = legendLocation.split("_");

    return {
        "insidePlot": vals[0] !== "outside",
        "leftSide": vals[2] !== "right",
        // 1=top, 0=center, -1=bottom...
        "alignment": (vals[1] === "bottom")? -1: ((vals[1] === "center")? 0 : 1)
    };
}

function addLegend(plotObject, legendParams, deletePrior = true) {
    let {
        legendNames = null,
        legendColors = null,
        legendOpacity = 1,
        legendLocation = "inside_top_left",
        legendTextSize = 13,
        legendPadding = 3
    } = legendParams;

    let {
        width,
        height,
        margins
    } = plotObject;

    let fullWidth = width;
    let fullHeight = height;
    width = fullWidth - margins.left - margins.right;
    height = fullHeight - margins.top - margins.bottom;

    if(legendNames !== null) {
        // Remove the old legend...
        if(deletePrior) plotObject.svg.selectAll(".legend").remove();

        legendLocation = parseLegendLocation(legendLocation);

        let legend = ((legendLocation.insidePlot)? plotObject.plotArea: plotObject.svg)
            .append("g")
            .attr("class", "legend");

        let shiftBy = ((legendLocation.alignment >= 0)? 1: -1) * (legendTextSize + legendPadding);

        let offset = legendPadding + (legendTextSize / 2);

        switch(legendLocation.alignment) {
            case 0:
                let legendHeight = legendPadding * (legendNames.length - 1) + legendTextSize * legendNames.length;
                offset = ((legendLocation.insidePlot)? height / 2: fullHeight / 2) - legendHeight / 2 + offset;
                break;
            case -1:
                offset = (legendLocation.insidePlot)? height - offset: fullHeight - offset;
                break;
            default:
                break;
        }

        let inset = legendPadding + (legendTextSize / 2);
        let textInset = (legendLocation.leftSide)? inset: -inset;
        inset = (legendLocation.leftSide)? inset: (legendLocation.insidePlot)? width - inset: fullWidth - inset;

        let anchorSide = legendLocation.leftSide? "start": "end";

        for(let i = 0; i < legendNames.length; i++) {
            legend.append("rect")
                .attr("stroke", (legendColors[i] !== "transparent")? "black": "none")
                .attr("fill", legendColors[i])
                .attr("x", inset - legendTextSize / 2)
                .attr("y", offset - legendTextSize / 2)
                .attr("width", legendTextSize)
                .attr("height", legendTextSize)
                .attr("r", legendTextSize / 2)
                .attr("opacity", legendOpacity);

            legend.append("text")
                .attr("x", inset + textInset)
                .attr("y", offset)
                .attr("dominant-baseline", "middle")
                .attr("text-anchor", anchorSide)
                .attr("font-size", legendTextSize)
                .attr("fill", "black")
                .text(legendNames[i]);

            offset += shiftBy;
        }

        let bbox = legend.node().getBBox();
        legend.insert("rect", "rect")
            .attr("x", bbox.x)
            .attr("y", bbox.y)
            .attr("width", bbox.width)
            .attr("height", bbox.height)
            .attr("rx", 10)
            .style("stroke", "rgb(245, 245, 245)")
            .style("stroke-width", 6 + "px")
            .style("fill", "rgb(245, 245, 245)")
            .attr("opacity", 0.6);
    }
}

let ID_GEN = 0;
function makePlotArea(selector, plotInfo) {
    d3.select(selector).select("svg").remove();

    let {
        yScaler,
        xScaler,
        xDomain,
        yDomain,
        dataList,
        plotXAxis = true,
        plotYAxis = true,
        width = 600,
        height = 400,
        margins = {top: 20, right: 30, bottom: 40, left: 50},
        title = "Example Graph",
        xLabel = "X Label",
        yLabel = "Y Label",
        xAttr = "x",
        yAttr = "y",
        labelSize = 15,
        titleSize = 20,
        interactive = false,
        onZoomOrPan = (evt) => {},
        zoomExtents = [1, 20],
        translateExtent = null
    } = plotInfo;

    // Setup graph size...
    let fullWidth = width;
    let fullHeight = height;
    width = fullWidth - margins.left - margins.right
    height = fullHeight - margins.top - margins.bottom;

    // Create an svg...
    let svg = d3.select(selector)
        .append("svg")
        // We use a viewBox instead of width/height to allow for the svg to dynamically resize to the page...
        .attr("viewBox", "0 0 " + fullWidth + " " + fullHeight)
        .attr("preserveAspectRatio", "xMidYMid meet")
        // For styling uses...
        .attr("class", "chart");

    let plotArea = svg
        .append("g")
        .attr("transform", "translate(" + margins.left + "," + margins.top + ")")


    plotArea.append("clipPath")
        .attr("id", "plot-box" + ID_GEN)
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", width)
        .attr("height", height);

    // Use data bounds to make x and y projections/transforms for going from data space to svg space.
    let xProj = xScaler().domain(xDomain(dataList, xAttr)).range([0, width]); // scaleTime, scaleLinear Ex...
    let yProj = yScaler().domain(yDomain(dataList, yAttr)).range([height, 0]);

    let xAxis = null;
    let yAxis = null;
    let axisEngineX = null;
    let axisEngineY = null;

    if(plotXAxis) {
        axisEngineX = d3.axisBottom(xProj);
        xAxis = plotArea.append("g").attr("transform", "translate(0, " + height + ")").call(axisEngineX);
    }
    if(plotYAxis) {
        axisEngineY = d3.axisLeft(yProj);
        yAxis = plotArea.append("g").call(axisEngineY);
    }

    plotArea = plotArea.append("g").attr("clip-path", "url(#plot-box" + ID_GEN + ")").append("g");
    ID_GEN++;

    if(interactive) {
        let zoomHandler = function(evt) {
            plotArea.attr("transform", evt.transform);
            if(xAxis != null) xAxis.call(axisEngineX.scale(evt.transform.rescaleX(xProj)));
            if(yAxis != null) yAxis.call(axisEngineY.scale(evt.transform.rescaleY(yProj)));
            onZoomOrPan(evt);
        }

        let zoom = d3.zoom()
            .scaleExtent(zoomExtents)
            .translateExtent(translateExtent ?? [[0, 0], [width, height]])
            .extent([[0, 0], [width, height]])
            .on("zoom", zoomHandler);

        svg.call(zoom);
    }

    let xLabelTxt = svg.append("text")
        .attr("x", margins.left + (width / 2))
        .attr("y", fullHeight)
        .attr("dominant-baseline", "ideographic")
        .attr("text-anchor", "middle")
        .attr("font-size", labelSize)
        .text(xLabel);

    let yLabelTxt = svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -(margins.top + (height / 2)))
        .attr("y", 0)
        .attr("dominant-baseline", "hanging")
        .attr("text-anchor", "middle")
        .attr("font-size", labelSize)
        .text(yLabel);

    let titleTxt = svg.append("text")
        .attr("x", fullWidth / 2)
        .attr("y", 0)
        .attr("dominant-baseline", "hanging")
        .attr("text-anchor", "middle")
        .attr("font-size", titleSize)
        .text(title);

    return {
        svg,
        plotArea,
        xProj,
        yProj,
        xLabel: xLabelTxt,
        yLabel: yLabelTxt,
        title: titleTxt,
        xAxis,
        yAxis,
        width: fullWidth,
        height: fullHeight,
        margins: margins,
        axisGenX: axisEngineX,
        axisGenY: axisEngineY
    };
}

function attrApplier(attrs) {
    return (obj) => {
        for(let name in attrs) {
            obj.attr(name, attrs[name]);
        }
        return obj;
    }
}

function prepArgs(dataList, xAttr, yAttr, attrs) {
    if(typeof(xAttr) == "string") {
        xAttr = Array(dataList.length).fill(xAttr);
    }
    if(typeof(yAttr) == "string") {
        yAttr = Array(dataList.length).fill(yAttr);
    }

    let applier = attrApplier(attrs);

    return [dataList, xAttr, yAttr, applier];
}

function transformColormapFunc(colorFunc, scale) {
    return (v) => {
        return colorFunc(scale(v));
    }
}

function scaledProjection(projection, scaleX, scaleY) {
    let data = function(data) {
        let [x, y] = projection(data)
        return [scaleX(x), scaleY(y)];
    };

    data.point = function(x, y) {
        [x, y] = projection([x, y]);
        return this.stream.point(scaleX(x), scaleY(y));
    };

    return [d3.geoTransform(data), data];
}

function addLine(plot, dataObj, index = 0, attrs = {}) {
    let {dataList, xAttr, yAttr} = dataObj;
    let {plotArea, xProj, yProj} = plot;

    [dataList, xAttr, yAttr, attrs] = prepArgs(dataList, xAttr, yAttr, attrs);

    console.log(d3.line()
        .x((d) => xProj(d[xAttr[index]]))
        .y((d) => yProj(d[yAttr[index]]))(dataList[index])
    );

    return attrs(plotArea.insert("path", ".legend")
        .attr("fill", "none")
        .attr("stroke-width", 1.5)
        .attr("stroke", "blue")
        .attr("d", d3.line()
            .x((d) => xProj(d[xAttr[index]]))
            .y((d) => yProj(d[yAttr[index]]))(dataList[index])
        ));
}

function addHover(selector, data, onEnter = () => {}, onExit = () => {}, onMove = () => {}) {
    let tooltip = d3.select(selector);

    // Create hover functions...
    let mouseon = (evt, d) => {
        tooltip.style("display", "block");
        onEnter(tooltip, d, d3.select(evt.target), evt);
    }

    let mousemove = (evt, d) => {
        onMove(tooltip, d, d3.select(evt.target), evt);

        tooltip
            .style("left", evt.clientX + "px")
            .style("top", evt.clientY + "px");
    }

    let mouseoff = (evt, d) => {
        tooltip.style("display", "none");
        onExit(tooltip, d, d3.select(evt.target), evt);
    }

    // Attach the events...
    data.on("mouseover", null).on("mousemove", null).on("mouseleave", null);
    data.on("mouseover", mouseon).on("mousemove", mousemove).on("mouseleave", mouseoff);
}

function addScatter(plot, dataObj, index = 0, attrs = {}) {
    let {dataList, xAttr, yAttr} = dataObj;
    let {plotArea, xProj, yProj} = plot;

    [dataList, xAttr, yAttr, attrs] = prepArgs(dataList, xAttr, yAttr, attrs);

    return attrs(plotArea.insert("g", ".legend")
        .selectAll("dot")
        .data(dataList[index])
        .enter()
        .append("circle")
        .attr("cx", (d) => xProj(d[xAttr[index]]))
        .attr("cy", (d) => yProj(d[yAttr[index]]))
        .attr("r", 3));
}

function addHistogram(plot, dataObj, index = 0, attrs = {}, padding = 5) {
    let {dataList, xAttr, yAttr} = dataObj;
    let {plotArea, xProj, yProj, height, margins} = plot;

    [dataList, xAttr, yAttr, attrs] = prepArgs(dataList, xAttr, yAttr, attrs);

    return attrs(
        plotArea.append("g")
            .selectAll("bins")
            .data(dataList[index])
            .enter()
            .append("rect")
            .attr("x", (d) => xProj(d[xAttr[index]]) + padding)
            .attr("y", (d) => yProj(d[yAttr[index]]))
            .attr("width", xProj.bandwidth() - padding * 2)
            .attr("height", (d) => (height - margins.top - margins.bottom) - yProj(d[yAttr[index]]))
            .attr("fill", "blue")
    );
}

function geoPlot(selector, world, centerLocation, scale, title, config = {}) {
    let {
        plotSize = [600, 400],
        margins = {top: 20, right: 100, bottom: 0, left: 0},
        backgroundColor = "#c3eeee",
        foregroundColor = "#f5e6cb",
        projection = "geoMercator",
        interactive = false,
        onZoomOrPan = (evt) => {},
        zoomExtents = [1, 20],
        translateExtent = null
    } = config;

    let [outerWidth, outerHeight] = plotSize
    let width = outerWidth - margins.left - margins.right;
    let height = outerHeight - margins.top - margins.bottom;

    let plot = makePlotArea(selector, {
        yScaler: d3.scaleLinear,
        xScaler: d3.scaleLinear,
        xDomain: getRawDomain([0, width]),
        yDomain: getRawDomain([height, 0]),
        dataList: [],
        plotXAxis: false,
        plotYAxis: false,
        legendOpacity: 1,
        width: outerWidth,
        height: outerHeight,
        margins: margins,
        title: title,
        xLabel: "",
        yLabel: "",
        xAttr: "x",
        yAttr: "y",
        labelSize: 15,
        titleSize: 20,
        interactive: interactive,
        onZoomOrPan: onZoomOrPan,
        zoomExtents: zoomExtents,
        translateExtent: translateExtent
    });

    let [projection1, callable_proj1] = scaledProjection(
        d3[projection]()
            .center(centerLocation)
            .scale(scale)
            .translate([width / 2, height / 2]),
        plot.xProj,
        plot.yProj
    );

    let pather = d3.geoPath()
        .projection(projection1);

    plot.plotArea
        .append("rect")
        .attr("x", plot.xProj(-width))
        .attr("y", plot.yProj(-height))
        .attr("width", plot.xProj(width * 3))
        .attr("height", plot.yProj(height * 3))
        .attr("fill", backgroundColor);

    plot.worldData = plot.plotArea
        .append("g")
        .selectAll("worldShape")
        .data(world.features)
        .enter()
        .append("path")
        .attr("id", (d) => "worldmap-" + d.properties.name)
        .attr("d", pather)
        .attr("fill", foregroundColor)
        .attr("stroke", "white")
        .attr("stroke-width", "0.5px");

    plot.worldProjection = projection1;
    plot.worldProjectionFunc = callable_proj1;
    return plot;
}