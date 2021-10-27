"use strict";

let WORLD = {};

let DATA = {};
let PlotElements = {};

let COLORMAPS = [
    "Inferno",
    "Magma",
    "Plasma",
    "Warm",
    "Cool",
    "CubehelixDefault",
    "BuGn",
    "BuPu",
    "GnBu",
    "OrRd",
    "PuBuGn",
    "PuBu",
    "PuRd",
    "RdPu",
    "YlGnBu",
    "YlGn",
    "YlOrBr",
    "YlOrRd",
    "Blues",
    "Greens",
    "Greys",
    "Oranges",
    "Purples",
    "Reds"
]

let numSort = (a, b) => a - b;

let VIEWABLE_ATTRIBUTES = {
    // Pretty name: [table name, domain type, legend title, reversed, is number, filter zero]
    "Polisity": ["Polisity", ordinalDomain(numSort), "Certainty", true, true, false],
    "Hellenicity": ["Hellenicity", ordinalDomain(numSort), "Most Greek", true, true, false],
    //"In and Out of Existance": ["In/out", ordinalDomain, ""],
    "Staseis": ["staseis", numericDomain, "Occurrences", false, true, true],
    "Prominence 1": ["prom 1", numericDomain, "Prominence", false, true, false],
    "Prominence 2": ["prom 2", ordinalDomain(numSort), "Prominence", false, true, false],
    "Prominence 3": ["prom 3", ordinalDomain(numSort), "Prominence", false, true, false],
    "Total Controlled Area": ["area 1", ordinalDomain(numSort), "Area Category", false, true, true],
    "Area Within Polis": ["area 2", numericDomain, "Area (Hectares)", false, true, true],
    //"Silver Coins Issued": ["Silver", ]
};

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
        //.attr("clip-path", "url(#plot-box)");

    // Use data bounds to make x and y projections/transforms for going from data space to svg space.
    let xProj = xScaler().domain(xDomain(dataList, xAttr)).range([0, width]); // scaleTime, scaleLinear Ex...
    let yProj = yScaler().domain(yDomain(dataList, yAttr)).range([height, 0]);

    let xAxis = null;
    let yAxis = null;

    if(plotXAxis)
        xAxis = plotArea.append("g").attr("transform", "translate(0, " + height + ")").call(d3.axisBottom(xProj));
    if(plotYAxis)
        yAxis = plotArea.append("g").call(d3.axisLeft(yProj));

    plotArea = plotArea.append("g").attr("clip-path", "url(#plot-box)");

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
        margins: margins
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

function update(info = {}) {
    let  {
        plotName,
        colormap = "Plasma",
        colorField = "Staseis",
        numColors = 14,
        reverseCMap = false
    } = info;

    let [
        tblName,
        domain,
        legendTitle,
        reverse,
        isNumeric,
        filterZero
    ] = VIEWABLE_ATTRIBUTES[colorField];

    if(isNumeric) {
        for(let row of DATA.polisData) {
            row[tblName] = (row[tblName] === "")? null: +row[tblName];
        }
    }

    let rangeArr = reverseCMap? [1, 0]: [0, 1];
    let modCMap = transformColormapFunc(d3["interpolate" + colormap], d3.scaleLinear().domain([0, 1]).range(rangeArr));
    let cList = d3.range(numColors).map((d) => modCMap(d / numColors));

    let finalColorMap = buildMapper(DATA.polisData, tblName, cList, domain);
    let legendColors = getCMapLabels(finalColorMap, legendTitle, reverse);

    addLegend(PlotElements[plotName].plot, {
        legendNames: legendColors.labels,
        legendColors: legendColors.colorLabels,
        legendOpacity: 1,
        legendLocation: "outside_center_right",
        legendTextSize: 13,
        legendPadding: 3,
    });

    addHover("#tooltip", PlotElements[plotName].polis, (d) => "Name: " + d.Name + "<br>" + colorField + ": " + d[tblName]);

    PlotElements[plotName].polis.on("click", (evt, d) => {
        window.open(d["Pleiades link"], '_blank');
    })

    PlotElements[plotName].polis
        .attr("r", (d) => ((d[tblName] != null)? 2.5: 0) + "px")
        .attr("fill", (d) => (d[tblName] != null && !(filterZero && d[tblName] === 0))? finalColorMap(d[tblName]): "transparent");
}

function addLine(plot, dataObj, index = 0, attrs = {}) {
    let {dataList, xAttr, yAttr} = dataObj;
    let {plotArea, xProj, yProj} = plot;

    [dataList, xAttr, yAttr, attrs] = prepArgs(dataList, xAttr, yAttr, attrs);

    return attrs(plotArea.insert("path", ".legend")
        .datum(dataList[index])
        .enter()
        .attr("fill", "none")
        .attr("stroke-width", 1.5)
        .attr("stroke", "blue")
        .attr("d", d3.line()
            .x((d) => xProj(d[xAttr[index]]))
            .y((d) => yProj(d[yAttr[index]]))
        ));
}

function addHover(selector, data, textFunc) {
    let tooltip = d3.select(selector);

    // Create hover functions...
    let mouseon = (evt, d) => {
        d3.select(evt.target).attr("stroke", "black").attr("stroke-width", "3px");
        tooltip.style("opacity", 1).style("display", "block");
    }

    let mousemove = (evt, d) => {
        tooltip.html(
            textFunc(d)
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

function geoPlot(plotName, selector, world, data, centerLocation, scale, title = "Poleis in the Mediterranean") {
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
        margins: {top: 10, right: 90, bottom: 0, left: 0},
        title: title,
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
        .attr("fill", "white");//"#c3eeee");

    let worldData = plot.plotArea
        .append("g")
        .selectAll("worldShape")
        .data(world.features)
        .enter()
        .append("path")
        .attr("d", pather)
        .attr("fill", "lightgrey")//"#f5e6cb")
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

    update({
        plotName: plotName
    });
}

function makePlots() {
    // Load the data...
    Promise.all([
        d3.csv("data/polis_data_distributed.csv"),
        d3.json("data/countries-coastline-2km5.geo.json")
    ]).then((data) => {
        // Unpack loaded files...
        [DATA.polisData, DATA.world] = data;

        console.log(DATA);
        geoPlot(
            "plot1", "#figure1", DATA.world, DATA.polisData, [21.048012, 39.553127], 500,
            "Stasis Occurrences"
        );
        geoPlot(
            "plot2", "#figure3", DATA.world, DATA.polisData, [24.048012, 38.053127], 1300,
            "Stasis Occurrences (Zoomed In)"
        );
        geoPlot(
            "plot3", "#figure2", DATA.world, DATA.polisData, [21.048012, 39.553127], 500,
            "Area Within Polis"
        );
        geoPlot(
            "plot4", "#figure4", DATA.world, DATA.polisData, [24.048012, 38.053127], 1300,
            "Area Within Polis (Zoomed In)"
        );

        update({
            plotName: "plot1",
            colormap: "Plasma",
            colorField: "Staseis",
            numColors: 10,
            reverseCMap: true
        });

        update({
            plotName: "plot2",
            colormap: "Plasma",
            colorField: "Staseis",
            numColors: 10,
            reverseCMap: true
        });

        update({
            plotName: "plot3",
            colormap: "Plasma",
            colorField: "Area Within Polis",
            numColors: 10,
            reverseCMap: true
        });

        update({
            plotName: "plot4",
            colormap: "Plasma",
            colorField: "Area Within Polis",
            numColors: 10,
            reverseCMap: true
        });

        // Histogram
        let counts = {};
        let total = {}
        let histData = [];
        for(let entry of DATA.polisData) {
            if(entry["staseis"] == 0 || entry["area 1"] == 0) continue;

            counts[entry["area 1"]] = (counts[entry["area 1"]] ?? 0) + 1;
            total[entry["area 1"]] = (total[entry["area 1"]] ?? 0) + entry["staseis"];
        }
        for(let item in counts) histData.push({"area": item, "staseis": total[item] / counts[item]});

        PlotElements.areaBar = makePlotArea("#figure5", {
            yScaler: d3.scaleLinear,
            xScaler: d3.scaleBand,
            xDomain: ordinalDomain(numSort),
            yDomain: numericDomain,
            dataList: [histData],
            width: 600,
            height: 400,
            title: "Total Controlled Area vs. Stasis Occurrences",
            xLabel: "Total Controlled Land (Category)",
            yLabel: "Average Number of Stasis",
            xAttr: ["area"],
            yAttr: ["staseis"],
            labelSize: 15,
            titleSize: 20
        });

        let histogram = addHistogram(PlotElements.areaBar, {dataList: [histData], xAttr: "area", yAttr: "staseis"}, 0, {
            "fill": "#5ab4cd"
        });

        let round = (d) => Math.round(d * 100) / 100

        addHover("#tooltip", histogram, (d) => "Area: " + d.area + "<br>Avg. Staseis: " + round(d.staseis))

        DATA.filteredPolis = DATA.polisData.filter((d) => d.staseis !== 0 && d["area 2"] !== "" && d["area 2"] !== 0);

        PlotElements.linePlot = makePlotArea("#figure6", {
            yScaler: d3.scaleLinear,
            xScaler: d3.scaleLinear,
            xDomain: numericDomain,
            yDomain: getPaddedDomain(3),
            dataList: [DATA.filteredPolis],
            width: 600,
            height: 400,
            title: "Polis Area vs. Stasis Occurrences",
            xLabel: "Land Area of Polis",
            yLabel: "Number of Stasis",
            xAttr: ["area 2"],
            yAttr: ["staseis"],
            labelSize: 15,
            titleSize: 20
        });

        let scatter = addScatter(
            PlotElements.linePlot,
            {dataList: [DATA.filteredPolis], xAttr: "area 2", yAttr: "staseis"},
            0,
            {
                "fill": "#5ab4cd"
            }
        );

        addHover("#tooltip", scatter, (d) => "Name: " + d.Name + "<br>Area: " + d["area 2"] + "<br>Staseis: " + d["staseis"]);
    })
}


window.onload = makePlots;

