"use strict";

const DATE_PARSER = d3.timeParse("%Y");
const DATE_PARSER2 = d3.timeParse("%Y %m");
const DATE_EXPORTER = d3.timeFormat("%Y");
const DATE_EXPORTER2 = d3.timeFormat("%Y");

let ORIG_DATA = {};

let [WIDTH, HEIGHT] = [600, 400];
let MARGINS = {top: 20, right: 30, bottom: 40, left: 50};

let [HIST_WIDTH, HIST_HEIGHT] = [1200, 400];

let CATEGORIES = {
    "General Categories": {
        "Food": "Food (Highlighted)",
        "Housing": "Housing",
        "Apparel and services": "Apparel",
        "Transportation": "Transportation",
        "Healthcare": "Healthcare",
        "Entertainment": "Entertainment",
        "Personal care products and services": "Personal Care",
        "Reading": "Reading",
        "Education***": "Education",
        "Tobacco products and smoking supplies": "Tobacco/Smoking",
        "Miscellaneous***": "Other",
        "Cash contributions": "Donations",
        "Personal insurance and pensions": "Insurance",
    },
    "Food Specific Categories": {
        "Food away from home": "Away From Home",
        "Food at home": "Home Food:",
        "Cereals and bakery products": "Cereal/Baked Goods",
        "Meats, poultry, fish, and eggs": "Meat/Poultry/Fish/Eggs",
        "Dairy products": "Dairy",
        "Fruits and vegetables": "Fruits",
        "Other food at home": "Other"
    }
}

let REFERENCE = "Average annual expenditures";

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

let HIST_COLORS = [
    "rgb(82, 84, 163)",
    "rgb(231, 186, 82)"
]

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

function makePlotArea(selector, dataObj, title, xLabel, yLabel, width, height, margins) {
    d3.select(selector).select("svg").remove();

    let {
        yScaler,
        xScaler,
        xDomain,
        yDomain,
        dataList,
        legendNames = null,
        legendColors = null,
        xAttr = "x",
        yAttr = "y",
        labelSize = 15,
        titleSize = 20,
        legendTextSize = 13,
        legendPadding = 3
    } = dataObj;

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

        let legend = plotArea.append("g").attr("class", "legend");

        let offset = legendPadding + (legendTextSize / 2);
        let inset = legendPadding + (legendTextSize / 2)

        for(let i = 0; i < legendNames.length; i++) {
            legend.append("circle")
                .attr("stroke", "none")
                .attr("fill", legendColors[i])
                .attr("cx", inset)
                .attr("cy", offset)
                .attr("r", legendTextSize / 2);

            legend.append("text")
                .attr("x", inset * 2)
                .attr("y", offset)
                .attr("dominant-baseline", "middle")
                .attr("text-anchor", "center")
                .attr("font-size", legendTextSize)
                .attr("fill", "black")
                .text(legendNames[i]);

            offset += legendTextSize + legendPadding;
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

function addLine(plotArea, xProj, yProj, dataObj, index = 0, attrs = {}) {
    let {dataList, xAttr, yAttr} = dataObj;
    [dataList, xAttr, yAttr, attrs] = prepArgs(dataList, xAttr, yAttr, attrs);

    return attrs(plotArea.insert("path", ".legend")
        .datum(dataList[index])
        .attr("fill", "none")
        .attr("stroke-width", 1.5)
        .attr("stroke", "blue")
        .attr("d", d3.line()
            .x((d) => xProj(d[xAttr[index]]))
            .y((d) => yProj(d[yAttr[index]]))
        ));
}

function addScatter(plotArea, xProj, yProj, dataObj, index = 0, attrs = {}) {
    let {dataList, xAttr, yAttr} = dataObj;
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

function updateLinePlot(
    data,
    selector,
    category,
    title,
    xLabel,
    yLabel,
    dataDomain = getPaddedDomain(4),
    emph = null
) {
    category = CATEGORIES[category];
    let dataNames = Array.from(Object.keys(category));
    let legendNames = Array.from(Object.values(category));

    let dataInfo1 = {
        "yScaler": d3.scaleLinear,
        "xScaler": d3.scaleTime,
        "yDomain": dataDomain,
        "xDomain": getRawDomain([DATE_PARSER2("2012 06"), DATE_PARSER2("2020 06")]),
        "dataList": Array(dataNames.length).fill(data),
        "legendNames": legendNames,
        "legendColors": COLORS,
        "xAttr": "Year",
        "yAttr": dataNames
    }

    let plotArea1 = makePlotArea(
        selector,
        dataInfo1,
        title,
        xLabel,
        yLabel,
        WIDTH,
        HEIGHT,
        MARGINS
    )

    let opacityVal = 0.40;

    let tooltip = d3.select(selector)
        .append("div")
        .attr("class", "tooltip");

    for(let i = 0; i < dataInfo1.dataList.length; i++) {
        let line = null;
        let scatter = null;
        let isOther = emph !== null && emph !== dataInfo1.legendNames[i];

        if(isOther) {
            line = addLine(plotArea1.plotArea, plotArea1.xProj, plotArea1.yProj, dataInfo1, i, {
                "stroke": COLORS[i],
                "opacity": opacityVal
            });
            scatter = addScatter(plotArea1.plotArea, plotArea1.xProj, plotArea1.yProj, dataInfo1, i, {
                "fill": COLORS[i],
                "opacity": opacityVal
            });
        }
        else {
            line = addLine(plotArea1.plotArea, plotArea1.xProj, plotArea1.yProj, dataInfo1, i, {"stroke": COLORS[i]});
            scatter = addScatter(plotArea1.plotArea, plotArea1.xProj, plotArea1.yProj, dataInfo1, i, {"fill": COLORS[i]});
        }

        let mouseon = (evt, d) => {
            line.style("opacity", 1);
            scatter.style("opacity", 1);
            tooltip.style("opacity", 1).style("display", "block");
        }

        let mousemove = (evt, d) => {
            let bbox = tooltip.html(
                "Line: " + legendNames[i] +
                "<br>Year: " + DATE_EXPORTER(d.Year) +
                "<br>Percent of Total: " + Math.round(d[dataNames[i]] * 100) / 100 + "%"
            ).node().getBoundingClientRect();

            tooltip
                .style("left", evt.clientX + "px")
                .style("top", (evt.clientY - 10) + "px");
        }

        let mouseoff = (evt, d) => {
            if(isOther) {
                line.style("opacity", opacityVal);
                scatter.style("opacity", opacityVal);
            }
            tooltip.style("opacity", 0).style("display", "none");
        }

        scatter.on("mouseover", mouseon).on("mousemove", mousemove).on("mouseleave", mouseoff);
    }

}

function updateHistogramPlot(
    data,
    selector,
    category,
    title,
    xLabel,
    yLabel,
    year1,
    year2,
    padding = 10
) {
    category = CATEGORIES[category];
    let dataNames = Array.from(Object.keys(category));
    let legendNames = Array.from(Object.values(category));

    data = data.filter((entry) => (DATE_EXPORTER2(entry.Year) == year1 || DATE_EXPORTER2(entry.Year) == year2));

    let newData = {}

    for(let entry of data) {
        for(let name of dataNames) {
            newData[name] = newData[name] ?? {};
            newData[name][DATE_EXPORTER2(entry.Year)] = entry[name];
        }
    }

    newData = Array.from(Object.keys(newData)).map((name) => {
        return {"group": category[name], ...newData[name]}
    });

    let dataInfo1 = {
        "yScaler": d3.scaleLinear,
        "xScaler": d3.scaleBand,
        "yDomain": getRawDomain([0, 35]),
        "xDomain": getRawDomain(legendNames),
        "dataList": [data, data],
        "legendNames": [year1, year2],
        "legendColors": HIST_COLORS,
        "xAttr": "group",
        "yAttr": [year1, year2]
    }

    let plot1 = makePlotArea(
        selector,
        dataInfo1,
        title,
        xLabel,
        yLabel,
        HIST_WIDTH,
        HIST_HEIGHT,
        MARGINS
    )

    let {plotArea, xProj, yProj} = plot1;

    let bins = plotArea.append("g")
        .selectAll("bins")
        .data(newData)
        .enter()
        .append("rect")
        .attr("x", (d) => xProj(d.group) + padding)
        .attr("y", (d) => yProj(d[year1]))
        .attr("width", xProj.bandwidth() / 2 - padding)
        .attr("height", (d) => (HIST_HEIGHT - MARGINS.top - MARGINS.bottom) - yProj(d[year1]))
        .attr("fill", dataInfo1.legendColors[0])

    let bins2 = plotArea.append("g")
        .selectAll("bins2")
        .data(newData)
        .enter()
        .append("rect")
        .attr("x", (d) => xProj(d.group) + xProj.bandwidth() / 2)
        .attr("y", (d) => yProj(d[year2]))
        .attr("width", xProj.bandwidth() / 2 - padding)
        .attr("height", (d) => (HIST_HEIGHT - MARGINS.top - MARGINS.bottom) - yProj(d[year2]))
        .attr("fill", dataInfo1.legendColors[1])

    let tooltip = d3.select(selector)
        .append("div")
        .attr("class", "tooltip");

    let mouseon = (evt, d) => {
        tooltip.style("opacity", 1).style("display", "block");
    };

    let mousemove = (year) => function (evt, d) {
        let bounds = this.getBoundingClientRect();

        console.log(bounds);

        tooltip.html("Group: " + d.group + "<br>Percent of Total: " + Math.round(d[year] * 100) / 100 + "%")
            .style("left", (bounds.left + bounds.right) / 2 + "px")
            .style("top", bounds.top - 5 + "px");
    };

    let mouseoff = (evt, d) => {
        tooltip.style("opacity", 0).style("display", "none");
    };

    bins.on("mouseover", mouseon).on("mousemove", mousemove(year1)).on("mouseleave", mouseoff);
    bins2.on("mouseover", mouseon).on("mousemove", mousemove(year2)).on("mouseleave", mouseoff);
}

function makePlots() {
    //Read the data
    d3.csv("data/food_spending.csv").then(function(data) {
        data = data.map(
            (entry) => {
                let newEntry = {}
                for(let key in entry) {
                    if(key !== REFERENCE && key !== "Year") {
                        newEntry[key] = +entry[key] / (+entry[REFERENCE]) * 100;
                    }
                    else {
                        newEntry[key] = +entry[key];
                    }
                }
                return {...newEntry, "Year": DATE_PARSER(entry["Year"])};
            }
        );

        ORIG_DATA = data;

        updateLinePlot(
            ORIG_DATA,
            "#figure1",
            "General Categories",
            "Consumer Expenditures: General Categories",
            "Year",
            "Percent of Total Expenditures",
            getPaddedDomain(2),
            "Food (Highlighted)"
        );
        updateLinePlot(
            ORIG_DATA,
            "#figure2",
            "Food Specific Categories",
            "Consumer Expenditures: Food",
            "Year",
            "Percent of Total Expenditures",
            getRawDomain([-0.75, 11]),
            null
        );

        updateHistogramPlot(
            ORIG_DATA,
            "#figure3",
            "General Categories",
            "Consumer Expenditures: 2019 vs. 2020.",
            "General Category",
            "Percent of Total Expenditures",
            2019,
            2020
        );
    });
}

window.onload = makePlots;

