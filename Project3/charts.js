"use strict";

let WORLD = {};

let DATA = {};
let PlotElements = {};

function buildMapper(data, attrs, colors) {
    let [min, max] = numericDomain([data], [attrs]);

    return (value) => {
        let norm_color = (value - min) / (max - min);
        let no_correct_idx = Math.floor(norm_color * colors.length);
        return colors[no_correct_idx - Math.floor(no_correct_idx / colors.length)];
    }
}

function getCMapLabels(data, attrs, colors) {
    let [min, max] = numericDomain([data], [attrs]);
    let vals = [];

    for(let i = 0; i < colors.length; i++)
        vals[i] = (((i / colors.length) * (max - min)) + min);

    return {
        labels: ["Time (s)", ...vals.reverse()],
        colorLabels: [...colors, "transparent"].reverse()
    }
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

function categoryDomain(dataList, attrs) {
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
    finalArr.sort();

    return finalArr;
}

function getPaddedDomain(padding = 1) {
    return (d, lbl) => {
        let [b, t] = numericDomain(d, lbl);
        let sign = Math.sign(t - b);
        return [b - sign * padding, t + sign * padding];
    }
}

function getRawDomain(arr) {
    return (a, b) => arr;
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
        titleSize = 20
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

    svg.append("clipPath")
        .attr("id", "plot-box")
        .append("rect")
        .attr("x", margins.left)
        .attr("y", margins.top)
        .attr("width", width)
        .attr("height", height)

    let plotArea = svg
        .append("g")
        .attr("transform", "translate(" + margins.left + "," + margins.top + ")")
        .attr("clip-path", "url(#plot-box)");

    // Use data bounds to make x and y projections/transforms for going from data space to svg space.
    let xProj = xScaler().domain(xDomain(dataList, xAttr)).range([0, width]); // scaleTime, scaleLinear Ex...
    let yProj = yScaler().domain(yDomain(dataList, yAttr)).range([height, 0]);

    let xAxis = null;
    let yAxis = null;

    if(plotXAxis)
        xAxis = plotArea.append("g").attr("transform", "translate(0, " + height + ")").call(d3.axisBottom(xProj));
    if(plotYAxis)
        yAxis = plotArea.append("g").call(d3.axisLeft(yProj));

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
        yAxis
    };
}

function prepArgs(dataList, xAttr, yAttr, attrs) {
    if(typeof(xAttr) == "string") {
        xAttr = Array(dataList.length).fill(xAttr);
    }
    if(typeof(yAttr) == "string") {
        yAttr = Array(dataList.length).fill(yAttr);
    }

    let applier = (obj) => {
        for(let name in attrs) {
            obj.attr(name, attrs[name]);
        }
        return obj;
    }

    return [dataList, xAttr, yAttr, applier];
}

function setupHover(selector, rects) {
    let tooltip = d3.select(selector);

    // Create hover functions...
    let mouseon = (evt, d) => {
        d3.select(evt.target).attr("stroke", "black").attr("stroke-width", "3px");
        tooltip.style("opacity", 1).style("display", "block");
    }

    let mousemove = (evt, d) => {
        tooltip.html(
            "Time Spent: " + Math.round((d.count / VIDEO_FPS) * 100) / 100 + "s"
        );

        tooltip
            .style("left", evt.clientX + "px")
            .style("top", (evt.clientY - 10) + "px");
    }

    let mouseoff = (evt, d) => {
        tooltip.style("opacity", 0).style("display", "none");
        d3.select(evt.target).attr("stroke", "none");
    }

    // Attach the events...
    rects.on("mouseover", mouseon).on("mousemove", mousemove).on("mouseleave", mouseoff);
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

function geoPlot(plotName, selector, world, data, centerLocation, scale, colormap, colorField) {
    let [width, height] = [300, 200];

    let plot = makePlotArea(selector, {
        yScaler: d3.scaleLinear,
        xScaler: d3.scaleLinear,
        xDomain: getRawDomain([0, width]),
        yDomain: getRawDomain([height, 0]),
        dataList: [],
        plotXAxis: false,
        plotYAxis: false,
        legendOpacity: 1,
        width: 600,
        height: 400,
        margins: {top: 10, right: 50, bottom: 0, left: 0},
        title: "Poleis in the Mediterranean",
        xLabel: "",
        yLabel: "",
        xAttr: "x",
        yAttr: "y",
        labelSize: 15,
        titleSize: 20
    });

    let [projection1, callable_proj1] = scaledProjection(
        d3.geoMercator()
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
        .attr("x", plot.xProj(0))
        .attr("y", plot.yProj(0))
        .attr("width", plot.xProj(width))
        .attr("height", plot.yProj(height))
        .attr("fill", "paleturquoise");

    let worldData = plot.plotArea
        .append("g")
        .selectAll("worldShape")
        .data(world.features)
        .enter()
        .append("path")
        .attr("d", pather)
        .attr("fill", "wheat")
        .attr("stroke", "white")
        .attr("stroke-width", "0.5px");

    let polisData = plot.plotArea
        .append("g")
        .selectAll("poleis")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", (d) => callable_proj1([d.Longitude, d.Latitude])[0])
        .attr("cy", (d) => callable_proj1([d.Longitude, d.Latitude])[1])
        .attr("r", "1.5px")
        .attr("fill", "black")

    PlotElements[plotName] = {
        plot,
        world: worldData,
        polis: polisData
    };
}

function makePlots() {
    // Load the data...
    Promise.all([
        d3.csv("data/polis_data_distributed.csv"),
        d3.json("data/countries-coastline-2km5.geo.json")
    ]).then((data) => {
        // Unpack loaded files...
        [DATA.polis_data, DATA.world] = data;

        console.log(DATA);
        geoPlot("plot1", "#figure1", DATA.world, DATA.polis_data, [21.048012, 39.553127], 500);
        geoPlot("plot2", "#figure2", DATA.world, DATA.polis_data, [24.048012, 38.053127], 1300);
    })
}


window.onload = makePlots;

