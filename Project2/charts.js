"use strict";

let ORIG_DATA = {};

let [WIDTH, HEIGHT] = [600, 400];
let MARGINS = {top: 25, right: 65, bottom: 40, left: 50};
let VIDEO_SIZE = {"width": 640, "height": 480};
let VIDEO_FPS = 15;

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
    "Reds",
    "Teal"
]

let COLORMAP_DEFAULT = "Teal";

d3.interpolateTeal = d3.interpolateRgbBasis([
    "rgba(255, 255, 255, 1)",
    "rgba(253, 254, 255, 1)",
    "rgba(251, 253, 255, 1)",
    "rgba(249, 253, 255, 1)",
    "rgba(247, 252, 255, 1)",
    "rgba(245, 251, 255, 1)",
    "rgba(243, 250, 255, 1)",
    "rgba(241, 250, 255, 1)",
    "rgba(239, 249, 255, 1)",
    "rgba(236, 248, 255, 1)",
    "rgba(234, 247, 255, 1)",
    "rgba(232, 246, 255, 1)",
    "rgba(230, 246, 255, 1)",
    "rgba(228, 245, 255, 1)",
    "rgba(226, 244, 255, 1)",
    "rgba(224, 243, 255, 1)",
    "rgba(222, 243, 255, 1)",
    "rgba(220, 242, 255, 1)",
    "rgba(218, 241, 255, 1)",
    "rgba(216, 240, 255, 1)",
    "rgba(214, 239, 255, 1)",
    "rgba(212, 239, 255, 1)",
    "rgba(210, 238, 255, 1)",
    "rgba(208, 237, 255, 1)",
    "rgba(206, 236, 255, 1)",
    "rgba(203, 236, 255, 1)",
    "rgba(201, 235, 255, 1)",
    "rgba(199, 234, 255, 1)",
    "rgba(197, 233, 255, 1)",
    "rgba(195, 233, 255, 1)",
    "rgba(193, 232, 255, 1)",
    "rgba(191, 231, 255, 1)",
    "rgba(189, 230, 255, 1)",
    "rgba(187, 229, 255, 1)",
    "rgba(185, 229, 255, 1)",
    "rgba(183, 228, 255, 1)",
    "rgba(181, 227, 255, 1)",
    "rgba(179, 226, 255, 1)",
    "rgba(177, 226, 255, 1)",
    "rgba(175, 225, 255, 1)",
    "rgba(173, 224, 255, 1)",
    "rgba(171, 223, 255, 1)",
    "rgba(168, 222, 255, 1)",
    "rgba(166, 222, 255, 1)",
    "rgba(164, 221, 255, 1)",
    "rgba(162, 220, 255, 1)",
    "rgba(160, 219, 255, 1)",
    "rgba(158, 219, 255, 1)",
    "rgba(156, 218, 255, 1)",
    "rgba(154, 217, 255, 1)",
    "rgba(152, 216, 255, 1)",
    "rgba(150, 215, 255, 1)",
    "rgba(148, 215, 255, 1)",
    "rgba(146, 214, 255, 1)",
    "rgba(144, 213, 255, 1)",
    "rgba(142, 212, 255, 1)",
    "rgba(140, 212, 255, 1)",
    "rgba(138, 211, 255, 1)",
    "rgba(135, 210, 255, 1)",
    "rgba(133, 209, 255, 1)",
    "rgba(131, 208, 255, 1)",
    "rgba(129, 208, 255, 1)",
    "rgba(127, 207, 255, 1)",
    "rgba(125, 206, 255, 1)",
    "rgba(123, 205, 255, 1)",
    "rgba(121, 204, 255, 1)",
    "rgba(119, 203, 255, 1)",
    "rgba(117, 201, 255, 1)",
    "rgba(115, 200, 255, 1)",
    "rgba(113, 199, 255, 1)",
    "rgba(112, 198, 255, 1)",
    "rgba(110, 196, 255, 1)",
    "rgba(108, 195, 255, 1)",
    "rgba(106, 194, 255, 1)",
    "rgba(104, 192, 255, 1)",
    "rgba(102, 191, 255, 1)",
    "rgba(100, 190, 255, 1)",
    "rgba(98, 189, 255, 1)",
    "rgba(96, 187, 255, 1)",
    "rgba(94, 186, 255, 1)",
    "rgba(92, 185, 255, 1)",
    "rgba(90, 183, 255, 1)",
    "rgba(88, 182, 255, 1)",
    "rgba(86, 181, 255, 1)",
    "rgba(84, 180, 255, 1)",
    "rgba(82, 178, 255, 1)",
    "rgba(80, 177, 255, 1)",
    "rgba(79, 176, 255, 1)",
    "rgba(77, 174, 255, 1)",
    "rgba(75, 173, 255, 1)",
    "rgba(73, 172, 255, 1)",
    "rgba(71, 171, 255, 1)",
    "rgba(69, 169, 255, 1)",
    "rgba(67, 168, 255, 1)",
    "rgba(65, 167, 255, 1)",
    "rgba(63, 165, 255, 1)",
    "rgba(61, 164, 255, 1)",
    "rgba(59, 163, 255, 1)",
    "rgba(57, 162, 255, 1)",
    "rgba(55, 160, 255, 1)",
    "rgba(53, 159, 255, 1)",
    "rgba(51, 158, 255, 1)",
    "rgba(49, 156, 255, 1)",
    "rgba(48, 155, 255, 1)",
    "rgba(46, 154, 255, 1)",
    "rgba(44, 153, 255, 1)",
    "rgba(42, 151, 255, 1)",
    "rgba(40, 150, 255, 1)",
    "rgba(38, 149, 255, 1)",
    "rgba(36, 147, 255, 1)",
    "rgba(34, 146, 255, 1)",
    "rgba(32, 145, 255, 1)",
    "rgba(30, 144, 255, 1)",
    "rgba(28, 142, 255, 1)",
    "rgba(26, 141, 255, 1)",
    "rgba(24, 140, 255, 1)",
    "rgba(22, 138, 255, 1)",
    "rgba(20, 137, 255, 1)",
    "rgba(18, 136, 255, 1)",
    "rgba(16, 135, 255, 1)",
    "rgba(15, 133, 255, 1)",
    "rgba(13, 132, 255, 1)",
    "rgba(11, 131, 255, 1)",
    "rgba(9, 129, 255, 1)",
    "rgba(7, 128, 255, 1)",
    "rgba(5, 127, 255, 1)",
    "rgba(3, 126, 255, 1)",
    "rgba(1, 124, 255, 1)",
    "rgba(0, 123, 254, 1)",
    "rgba(0, 121, 253, 1)",
    "rgba(0, 119, 252, 1)",
    "rgba(0, 117, 251, 1)",
    "rgba(0, 115, 250, 1)",
    "rgba(0, 113, 249, 1)",
    "rgba(0, 111, 248, 1)",
    "rgba(0, 109, 246, 1)",
    "rgba(0, 107, 245, 1)",
    "rgba(0, 105, 244, 1)",
    "rgba(0, 103, 243, 1)",
    "rgba(0, 101, 242, 1)",
    "rgba(0, 99, 241, 1)",
    "rgba(0, 97, 239, 1)",
    "rgba(0, 96, 238, 1)",
    "rgba(0, 94, 237, 1)",
    "rgba(0, 92, 236, 1)",
    "rgba(0, 90, 235, 1)",
    "rgba(0, 88, 234, 1)",
    "rgba(0, 86, 233, 1)",
    "rgba(0, 84, 231, 1)",
    "rgba(0, 82, 230, 1)",
    "rgba(0, 80, 229, 1)",
    "rgba(0, 78, 228, 1)",
    "rgba(0, 76, 227, 1)",
    "rgba(0, 74, 226, 1)",
    "rgba(0, 72, 224, 1)",
    "rgba(0, 70, 223, 1)",
    "rgba(0, 68, 222, 1)",
    "rgba(0, 66, 221, 1)",
    "rgba(0, 64, 220, 1)",
    "rgba(0, 63, 219, 1)",
    "rgba(0, 61, 218, 1)",
    "rgba(0, 59, 216, 1)",
    "rgba(0, 57, 215, 1)",
    "rgba(0, 55, 214, 1)",
    "rgba(0, 53, 213, 1)",
    "rgba(0, 51, 212, 1)",
    "rgba(0, 49, 211, 1)",
    "rgba(0, 47, 210, 1)",
    "rgba(0, 45, 208, 1)",
    "rgba(0, 43, 207, 1)",
    "rgba(0, 41, 206, 1)",
    "rgba(0, 39, 205, 1)",
    "rgba(0, 37, 204, 1)",
    "rgba(0, 35, 203, 1)",
    "rgba(0, 33, 201, 1)",
    "rgba(0, 32, 200, 1)",
    "rgba(0, 30, 199, 1)",
    "rgba(0, 28, 198, 1)",
    "rgba(0, 26, 197, 1)",
    "rgba(0, 24, 196, 1)",
    "rgba(0, 22, 195, 1)",
    "rgba(0, 20, 193, 1)",
    "rgba(0, 18, 192, 1)",
    "rgba(0, 16, 191, 1)",
    "rgba(0, 14, 190, 1)",
    "rgba(0, 12, 189, 1)",
    "rgba(0, 10, 188, 1)",
    "rgba(0, 8, 186, 1)",
    "rgba(0, 6, 185, 1)",
    "rgba(0, 4, 184, 1)",
    "rgba(0, 2, 183, 1)",
    "rgba(0, 0, 182, 1)",
    "rgba(0, 0, 179, 1)",
    "rgba(0, 0, 177, 1)",
    "rgba(0, 0, 174, 1)",
    "rgba(0, 0, 171, 1)",
    "rgba(0, 0, 168, 1)",
    "rgba(0, 0, 165, 1)",
    "rgba(0, 0, 162, 1)",
    "rgba(0, 0, 160, 1)",
    "rgba(0, 0, 157, 1)",
    "rgba(0, 0, 154, 1)",
    "rgba(0, 0, 151, 1)",
    "rgba(0, 0, 148, 1)",
    "rgba(0, 0, 145, 1)",
    "rgba(0, 0, 142, 1)",
    "rgba(0, 0, 140, 1)",
    "rgba(0, 0, 137, 1)",
    "rgba(0, 0, 134, 1)",
    "rgba(0, 0, 131, 1)",
    "rgba(0, 0, 128, 1)",
    "rgba(0, 0, 125, 1)",
    "rgba(0, 0, 122, 1)",
    "rgba(0, 0, 120, 1)",
    "rgba(0, 0, 117, 1)",
    "rgba(0, 0, 114, 1)",
    "rgba(0, 0, 111, 1)",
    "rgba(0, 0, 108, 1)",
    "rgba(0, 0, 105, 1)",
    "rgba(0, 0, 103, 1)",
    "rgba(0, 0, 100, 1)",
    "rgba(0, 0, 97, 1)",
    "rgba(0, 0, 94, 1)",
    "rgba(0, 0, 91, 1)",
    "rgba(0, 0, 88, 1)",
    "rgba(0, 0, 85, 1)",
    "rgba(0, 0, 83, 1)",
    "rgba(0, 0, 80, 1)",
    "rgba(0, 0, 77, 1)",
    "rgba(0, 0, 74, 1)",
    "rgba(0, 0, 71, 1)",
    "rgba(0, 0, 68, 1)",
    "rgba(0, 0, 66, 1)",
    "rgba(0, 0, 63, 1)",
    "rgba(0, 0, 60, 1)",
    "rgba(0, 0, 57, 1)",
    "rgba(0, 0, 54, 1)",
    "rgba(0, 0, 51, 1)",
    "rgba(0, 0, 48, 1)",
    "rgba(0, 0, 46, 1)",
    "rgba(0, 0, 43, 1)",
    "rgba(0, 0, 40, 1)",
    "rgba(0, 0, 37, 1)",
    "rgba(0, 0, 34, 1)",
    "rgba(0, 0, 31, 1)",
    "rgba(0, 0, 28, 1)",
    "rgba(0, 0, 26, 1)",
    "rgba(0, 0, 23, 1)",
    "rgba(0, 0, 20, 1)",
    "rgba(0, 0, 17, 1)",
    "rgba(0, 0, 14, 1)",
    "rgba(0, 0, 11, 1)",
    "rgba(0, 0, 9, 1)",
    "rgba(0, 0, 6, 1)",
    "rgba(0, 0, 3, 1)",
    "rgba(0, 0, 0, 1)"
]);

function buildMapper(data, attrs, colors) {
    let [min, max] = numericDomain([data], [attrs]);

    return (value) => {
        let norm_color = (value - min) / (max - min);
        let no_correct_idx = Math.floor(norm_color * colors.length);
        return colors[no_correct_idx - Math.floor(no_correct_idx / colors.length)];
    }
}

function toHumanTime(frames, fps) {
    let timeSec = frames / fps;
    return Math.round(timeSec * 100) / 100
}

function getCMapLabels(data, attrs, colors) {
    let [min, max] = numericDomain([data], [attrs]);
    let vals = [];

    for(let i = 0; i < colors.length; i++)
        vals[i] = toHumanTime((((i / colors.length) * (max - min)) + min), VIDEO_FPS);

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

    return Array.from(symbolSet);
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

function makePlotArea(selector, plotInfo) {
    d3.select(selector).select("svg").remove();

    let {
        yScaler,
        xScaler,
        xDomain,
        yDomain,
        dataList,
        legendNames = null,
        legendColors = null,
        legendOpacity = 1,
        width = 600,
        height = 400,
        margins = {top: 20, right: 30, bottom: 40, left: 50},
        title = "Example Graph",
        xLabel = "X Label",
        yLabel = "Y Label",
        legendLocation = "inside_top_left",
        xAttr = "x",
        yAttr = "y",
        labelSize = 15,
        titleSize = 20,
        legendTextSize = 13,
        legendPadding = 3
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
        .attr("transform", "translate(" + margins.left + "," + margins.top + ")");

    // Use data bounds to make x and y projections/transforms for going from data space to svg space.
    let xProj = xScaler().domain(xDomain(dataList, xAttr)).range([0, width]); // scaleTime, scaleLinear Ex...
    let yProj = yScaler().domain(yDomain(dataList, yAttr)).range([height, 0]);

    plotArea.append("g").attr("transform", "translate(0, " + height + ")").call(d3.axisBottom(xProj));
    plotArea.append("g").call(d3.axisLeft(yProj));

    svg.append("text")
        .attr("x", margins.left + (width / 2))
        .attr("y", fullHeight)
        .attr("dominant-baseline", "ideographic")
        .attr("text-anchor", "middle")
        .attr("font-size", labelSize)
        .text(xLabel);

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -(margins.top + (height / 2)))
        .attr("y", 0)
        .attr("dominant-baseline", "hanging")
        .attr("text-anchor", "middle")
        .attr("font-size", labelSize)
        .text(yLabel);

    svg.append("text")
        .attr("x", fullWidth / 2)
        .attr("y", 0)
        .attr("dominant-baseline", "hanging")
        .attr("text-anchor", "middle")
        .attr("font-size", titleSize)
        .text(title)

    if(legendNames !== null) {
        legendLocation = parseLegendLocation(legendLocation);

        let legend = ((legendLocation.insidePlot)? plotArea: svg).append("g").attr("class", "legend");
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

    return {
        svg,
        plotArea,
        xProj,
        yProj,
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

let FILTER_THRESHOLD = 0.1;
let DEF_INDEXES = {
    "x": "x",
    "y": "y",
    "likelihood": "likelihood"
};

function toBins(data, binSize, indexes = DEF_INDEXES, videoDim = VIDEO_SIZE) {
    // Make the array...
    let binWidth = Math.ceil(videoDim.width / binSize);
    let binHeight = Math.ceil(videoDim.height / binSize);
    let bins = new Array(binWidth * binHeight);

    for(let x = 0; x < binWidth; x++) {
        for(let y = 0; y < binHeight; y++) {
            bins[x * binHeight + y] = {
                "count": 0,
                "video_x": x * binSize,
                "video_y": y * binSize
            };
        }
    }

    for(let row of data) {
        if(
            ((+row[indexes.likelihood]) < FILTER_THRESHOLD)
            || (+row[indexes.x] > videoDim.width)
            || (+row[indexes.x] < 0)
            || (+row[indexes.y] > videoDim.height)
            || (+row[indexes.y] < 0)
        ) {
            continue;
        }

        let xLoc = Math.floor(row[indexes.x] / binSize);
        let yLoc = Math.floor(row[indexes.y] / binSize);

        try {
            bins[xLoc * binHeight + yLoc].count += 1;
        } catch(e) {
            console.log(xLoc, yLoc, row[indexes.likelihood], bins[xLoc * binHeight + yLoc])
        }
    }

    return {
        width: binWidth,
        height: binHeight,
        binSize: binSize,
        bins: bins
    }
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

function updatePlots(
    data_name,
    selector1,
    selector2,
    title,
    binSize,
    colorSegments,
    colormapFunc = transformColormapFunc(d3.interpolateCubehelixDefault, d3.scaleLinear().domain([0, 1]).range([0.3, 1])),
    overlayOpacity = 0.5,
    underlayOpacity = 0.5
) {
    Promise.all([
        d3.csv("data/" + data_name + "control.cleancsv"), d3.csv("data/" + data_name + "so.cleancsv")
    ]).then((data) => {
        let [control, so] = data;

        control = toBins(control, binSize, {"x": "Nose_x", "y": "Nose_y", "likelihood": "Nose_likelihood"});
        so = toBins(so, binSize, {"x": "Nose_x", "y": "Nose_y", "likelihood": "Nose_likelihood"});

        let colors = d3.range(colorSegments).map((d) => colormapFunc(d / colorSegments));
        let controlColorMapper = buildMapper(control.bins, "count", colors);
        let soColorMapper = buildMapper(so.bins, "count", colors);

        let controlLabels = getCMapLabels(control.bins, "count", colors);
        let soLabels = getCMapLabels(so.bins, "count", colors);

        let controlPlot = makePlotArea(selector1, {
            yScaler: d3.scaleLinear,
            xScaler: d3.scaleLinear,
            xDomain: getRawDomain([0, VIDEO_SIZE.width]),
            yDomain: getRawDomain([VIDEO_SIZE.height, 0]),
            dataList: [control.bins],
            legendNames: controlLabels.labels,
            legendColors: controlLabels.colorLabels,
            legendOpacity: overlayOpacity,
            width: WIDTH,
            height: HEIGHT,
            margins: MARGINS,
            title: title + " Control Run",
            xLabel: "X Video Offset (Pixels)",
            yLabel: "Y Video Offset (Pixels)",
            legendLocation: "outside_center_right",
            xAttr: "x",
            yAttr: "y",
        });

        controlPlot.plotArea
            .append("image")
            .attr("href", "imgs/" + data_name + "controlTrace.png")
            .attr("x", controlPlot.xProj(0))
            .attr("y", controlPlot.yProj(0))
            .attr("width", controlPlot.xProj(VIDEO_SIZE.width))
            .attr("height", controlPlot.yProj(VIDEO_SIZE.height))
            .attr("image-rendering", "optimizeSpeed")
            .attr("preserveAspectRatio", "none")
            .attr("opacity", underlayOpacity);

        // Plot the bins!
        let controlRects = controlPlot.plotArea
            .selectAll("bins")
            .data(control.bins)
            .enter()
            .append("rect")
            .attr("x", (d) => controlPlot.xProj(d.video_x))
            .attr("y", (d) => controlPlot.yProj(d.video_y))
            .attr("width", (d) => {
                return Math.min(
                    controlPlot.xProj(binSize),
                    controlPlot.xProj(VIDEO_SIZE.width) - controlPlot.xProj(d.video_x)
                );
            })
            .attr("height", (d) => {
                return Math.min(
                    controlPlot.yProj(binSize),
                    controlPlot.yProj(VIDEO_SIZE.height) - controlPlot.yProj(d.video_y)
                );
            })
            .attr("fill", (d) => controlColorMapper(d.count))
            .attr("opacity", overlayOpacity);

        setupHover(selector1 + "_hover", controlRects);

        let soPlot = makePlotArea(selector2, {
            yScaler: d3.scaleLinear,
            xScaler: d3.scaleLinear,
            xDomain: getRawDomain([0, VIDEO_SIZE.width]),
            yDomain: getRawDomain([VIDEO_SIZE.height, 0]),
            dataList: [so.bins],
            legendNames: soLabels.labels,
            legendColors: soLabels.colorLabels,
            legendOpacity: overlayOpacity,
            width: WIDTH,
            height: HEIGHT,
            margins: MARGINS,
            title: title + " Social Object Run",
            xLabel: "X Video Offset (Pixels)",
            yLabel: "Y Video Offset (Pixels)",
            legendLocation: "outside_center_right",
            xAttr: "x",
            yAttr: "y"
        });

        soPlot.plotArea
            .append("image")
            .attr("href", "imgs/" + data_name + "soTrace.png")
            .attr("x", controlPlot.xProj(0))
            .attr("y", controlPlot.yProj(0))
            .attr("width", controlPlot.xProj(VIDEO_SIZE.width))
            .attr("height", controlPlot.yProj(VIDEO_SIZE.height))
            .attr("image-rendering", "optimizeSpeed")
            .attr("preserveAspectRatio", "none")
            .attr("opacity", underlayOpacity);

        // Plot the bins!
        let soRects = soPlot.plotArea
            .selectAll("bins")
            .data(so.bins)
            .enter()
            .append("rect")
            .attr("x", (d) => soPlot.xProj(d.video_x))
            .attr("y", (d) => soPlot.yProj(d.video_y))
            .attr("width", (d) => {
                return Math.min(
                    soPlot.xProj(binSize),
                    soPlot.xProj(VIDEO_SIZE.width) - soPlot.xProj(d.video_x)
                );
            })
            .attr("height", (d) => {
                return Math.min(
                    soPlot.yProj(binSize),
                    soPlot.yProj(VIDEO_SIZE.height) - soPlot.yProj(d.video_y)
                );
            })
            .attr("fill", (d) => soColorMapper(d.count))
            .attr("opacity", overlayOpacity);

        setupHover(selector2 + "_hover", soRects);
    })
}

function onSettingChange(evt) {
    let binSize = d3.select("#bucket_size").node().value;
    let ratExp = d3.select("#rat_select").node().value;
    let colorCount = d3.select("#num_colors").node().value;
    let colormap = d3.select("#colormap_select").node().value;
    let reverseCmap = d3.select("#reverse_colormap").node().checked;
    let bo = d3.select("#background_op").node().value;
    let ho = d3.select("#heatmap_op").node().value;

    let rangeArr = reverseCmap? [1, 0]: [0, 1];

    updatePlots(
        ratExp,
        "#figure1",
        "#figure2",
        "Rat " + ratExp[ratExp.length - 1],
        binSize,
        colorCount,
        transformColormapFunc(d3["interpolate" + colormap], d3.scaleLinear().domain([0, 1]).range(rangeArr)),
        ho,
        bo
    );
}

function sliderEvt(selector) {
    return (evt) => {
        let val = d3.select(selector).node().value;
        d3.select(selector + "_val").text(Math.round(val * 100) / 100);

        onSettingChange(evt);
    }
}

function makePlots() {
    d3.select("#colormap_select")
        .selectAll("colormaps")
        .data(COLORMAPS)
        .enter()
        .append("option")
        .property("selected", (d) => d == COLORMAP_DEFAULT)
        .attr("value", (d) => d)
        .text((d) => d);

    d3.select("#colormap_select").on("input", onSettingChange);
    d3.select("#bucket_size").on("input", sliderEvt("#bucket_size"));
    d3.select("#rat_select").on("input", onSettingChange);
    d3.select("#num_colors").on("input", sliderEvt("#num_colors"));
    d3.select("#reverse_colormap").on("input", onSettingChange);
    d3.select("#background_op").on("input", sliderEvt("#background_op"));
    d3.select("#heatmap_op").on("input", sliderEvt("#heatmap_op"));

    d3.select("#extra_options").on("input", (evt) => {
        d3.selectAll(".hidden_control").style("display", (evt.target.checked)? "block": "none");
    });

    // Initialize...
    onSettingChange(null);
}


window.onload = makePlots;

