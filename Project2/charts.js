"use strict";

let ORIG_DATA = {};

let [WIDTH, HEIGHT] = [600, 400];
let MARGINS = {top: 25, right: 65, bottom: 40, left: 50};
let VIDEO_SIZE = {"width": 640, "height": 480};
let VIDEO_FPS = 15;

let COLORS = [
    'rgb(57, 59, 121)',
    'rgb(82, 84, 163)',
    'rgb(107, 110, 207)',
    'rgb(156, 158, 222)',
    /*'rgb(99, 121, 57)',
    'rgb(140, 162, 82)',
    'rgb(181, 207, 107)',
    'rgb(206, 219, 156)',*/
    'rgb(140, 109, 49)',
    'rgb(189, 158, 57)',
    'rgb(231, 186, 82)',
    'rgb(231, 203, 148)',
    'rgb(132, 60, 57)',
    'rgb(173, 73, 74)',
    'rgb(214, 97, 107)',
    'rgb(231, 150, 156)',
    /*'rgb(123, 65, 115)',
    'rgb(165, 81, 148)',*/
    'rgb(206, 109, 189)',
    'rgb(222, 158, 214)'
]

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

    let pad_left = (val, char, amt) => {
        let repCnt = amt - String(val).length;
        let left = "";
        for(let i = 0; i < repCnt; i++) left = left + char;
        return left + val;
    };

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
        console.log(anchorSide);

        for(let i = 0; i < legendNames.length; i++) {
            legend.append("circle")
                .attr("stroke", "none")
                .attr("fill", legendColors[i])
                .attr("cx", inset)
                .attr("cy", offset)
                .attr("r", legendTextSize / 2);

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
        legend.insert("rect", "circle")
            .attr("x", bbox.x)
            .attr("y", bbox.y)
            .attr("width", bbox.width)
            .attr("height", bbox.height)
            .attr("rx", 10)
            .style("stroke", "rgb(235, 235, 235)")
            .style("stroke-width", 3)
            .style("fill", "rgb(235, 235, 235)")
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
            (row[indexes.likelihood] < FILTER_THRESHOLD)
            || (+row[indexes.x] > videoDim.width)
            || (+row[indexes.y] > videoDim.height)
        ) {
            console.log("no good...");
            continue;
        }

        let xLoc = Math.floor(row[indexes.x] / binSize);
        let yLoc = Math.floor(row[indexes.y] / binSize);

        bins[xLoc * binHeight + yLoc].count += 1;
    }

    return {
        width: binWidth,
        height: binHeight,
        binSize: binSize,
        bins: bins
    }
}

function updatePlots(
    data_name,
    selector1,
    selector2,
    title,
    binSize,
    colorSegments = 10
) {
    Promise.all([
        d3.csv("data/" + data_name + "control.cleancsv"), d3.csv("data/" + data_name + "so.cleancsv")
    ]).then((data) => {
        let [control, so] = data;

        control = toBins(control, binSize, {"x": "Nose_x", "y": "Nose_y", "likelihood": "Nose_likelihood"});
        so = toBins(so, binSize, {"x": "Nose_x", "y": "Nose_y", "likelihood": "Nose_likelihood"});

        let colors = d3.range(colorSegments).map((d) => d3.interpolatePlasma(d / colorSegments));
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
            width: WIDTH,
            height: HEIGHT,
            margins: MARGINS,
            title: title + " Control Run",
            xLabel: "X Video Offset (Pixels)",
            yLabel: "Y Video Offset (Pixels)",
            legendLocation: "outside_center_right",
            xAttr: "x",
            yAttr: "y"
        });

        controlPlot.plotArea
            .append("image")
            .attr("href", "imgs/" + data_name + "control.png")
            .attr("x", controlPlot.xProj(0))
            .attr("y", controlPlot.yProj(0))
            .attr("width", controlPlot.xProj(VIDEO_SIZE.width))
            .attr("height", controlPlot.yProj(VIDEO_SIZE.height))
            .attr("image-rendering", "optimizeSpeed")
            .attr("preserveAspectRatio", "none");

        // Plot the bins!
        controlPlot.plotArea
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
            .attr("opacity", 0.6);

        let soPlot = makePlotArea(selector2, {
            yScaler: d3.scaleLinear,
            xScaler: d3.scaleLinear,
            xDomain: getRawDomain([0, VIDEO_SIZE.width]),
            yDomain: getRawDomain([VIDEO_SIZE.height, 0]),
            dataList: [so.bins],
            legendNames: soLabels.labels,
            legendColors: soLabels.colorLabels,
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
            .attr("href", "imgs/" + data_name + "so.png")
            .attr("x", controlPlot.xProj(0))
            .attr("y", controlPlot.yProj(0))
            .attr("width", controlPlot.xProj(VIDEO_SIZE.width))
            .attr("height", controlPlot.yProj(VIDEO_SIZE.height))
            .attr("image-rendering", "optimizeSpeed")
            .attr("preserveAspectRatio", "none");

        // Plot the bins!
        soPlot.plotArea
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
            .attr("opacity", 0.6);
    })
}

function makePlots() {
    updatePlots("rat1", "#figure1", "#figure2", "Rat 1 ", 25);
}


window.onload = makePlots;

