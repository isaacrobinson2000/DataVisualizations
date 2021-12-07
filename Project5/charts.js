"use strict";

const TO_TIME = d3.timeParse("%Y-%m-%d");
const PRINT_TIME = d3.timeFormat("%B %d, %Y")

const COLOR_LIST = [
    "#1f77b4",
    "#aec7e8",
    "#ff7f0e",
    "#48ce8b",
    "#2ca02c",
    "#98df8a",
    "#d62728",
    "#ff9896",
    "#9467bd",
    "#c5b0d5",
    "#8c564b",
    "#c49c94",
    "#e377c2",
    "#f7b6d2",
    "#a55194",
    "#ffbb78",
    "#bcbd22",
    "#dbdb8d",
    "#17becf",
    "#9edae5",
    "#6b6ecf",
    "#b5cf6b",
    "#e7ba52",
    "#d6616b",
    "#7f7f7f"
];

async function getFrequencies() {
    let data = await d3.json("https://raw.githubusercontent.com/hodcroftlab/covariants/master/cluster_tables/EUClusters_data.json");

    let totals = {};

    for(let countryName in data.countries) {
        let country = data.countries[countryName];

        country.Other = country.total_sequences.map((d, i) => {
            for(let elem in country) if(elem !== "week" && elem !== "total_sequences") d -= country[elem][i];
            return d;
        });

        for(let i = 0; i < country.week.length; i++) {
            for(let elem in country) {
                if(elem == "week") continue;
                totals[elem] = totals[elem] ?? {};
                totals[elem][country.week[i]] = (totals[elem][country.week[i]] ?? 0) + country[elem][i];
            }

            country.week[i] = TO_TIME(country.week[i]);
        }
    }

    for(let elem in totals) {
        totals.week = Object.keys(totals[elem]);
        totals[elem] = Object.values(totals[elem]);
    }
    for(let i = 0; i < totals.week.length; i++) totals.week[i] = TO_TIME(totals.week[i]);
    for(let elem in data.plotting_dates) data.plotting_dates[elem] = TO_TIME(data.plotting_dates[elem]);

    data.totals = totals;

    return data;
}

function getSubIndex(data, country, date) {
    let weeks = ((country != null)? data.countries[country] ?? data[country]: data).week;
    let index = d3.bisectLeft(weeks, date);
    return (index < weeks.length)? index: weeks.length - 1;
}

function grabCountryDataForTime(data, country, date, keepTotal = true) {
    let index = getSubIndex(data, country, date);

    let countryData = {...((country != null)? data.countries[country] ?? data[country]: data)};
    let newList = [];

    for(let key in countryData) {
        if(key === "week") continue;
        if(!keepTotal && key === "total_sequences") continue;
        newList.push({"variant": key, "count": countryData[key][index]});
    }

    return newList;
}

function toDataList(data) {
    let covidVariants = Object.keys(data).filter((v) => (
        v !== "total_sequences" && v !== "week" && v !== "Other"
    ));
    covidVariants.push("Other");

    return [data.week.map((d, i) => {
        let newData = {};

        for(let key in data) {
            newData[key] = data[key][i];
        }

        for(let variant of covidVariants) newData[variant] /= (data.total_sequences[i] / 100);

        return newData;
    }), covidVariants];
}

async function updateLinePlot(selector, data, key, title, color) {
    let [listData, covidVariants] = toDataList(data);

    d3.select(selector).selectAll("*").remove();
    let linePlot = makePlotArea(selector, {
        yScaler: d3.scaleLinear,
        xScaler: d3.scaleTime,
        xDomain: getRawDomain([new Date(data.week[0].valueOf() - 864000000), new Date(data.week[data.week.length - 1].valueOf() + 864000000)]),
        yDomain: getPaddedDomain(1),
        dataList: [listData],
        legendOpacity: 1,
        width: 450,
        height: 300,
        margins: {top: 20, right: 30, bottom: 60, left: 50},
        title: title,
        yLabel: "Percentage of Sequences",
        xLabel: "Time of Sequencing",
        yAttr: key,
        xAttr: "week",
        labelSize: 15,
        titleSize: 18,
        interactive: true,
        zoomExtents: [1, 5],
        onZoomOrPan: (evt) => {
            linePlot.xAxis.selectAll("text").style("text-anchor", "start").attr("transform", "rotate(40)");
        }
    });
    linePlot.xAxis.selectAll("text").style("text-anchor", "start").attr("transform", "rotate(40)");

    if(!listData.every((d) => d[key] === undefined)) {
        let line = addLine(linePlot, {dataList: [listData], xAttr: ["week"], yAttr: [key]}, 0, {"stroke": color});
        let scatter = addScatter(linePlot, {dataList: [listData], xAttr: ["week"], yAttr: [key]}, 0, {"fill": color});

        addHover("#tooltip", scatter, (tooltip, d) => {
            tooltip.html("<span>Value: " + (Math.round(d[key] * 10) / 10) + "%</span>");
        })
    }
    else {
        // No data for this case, hide the lines...
        let [x1, x2] = linePlot.xProj.range();
        let [y1, y2] = linePlot.yProj.range();

        linePlot.plotArea.append("text")
            .attr("x", (x1 + x2) / 2)
            .attr("y", (y1 + y2) / 2)
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "middle")
            .attr("font-size", "20px")
            .text("No Data for this Variant");
    }


}

async function updateAreaPlot(selector, data, title="COVID-19 Variants over Time (Worldwide)", colorMap = null) {
    let [listData, covidVariants] = toDataList(data);

    let stackGen = d3.stack().keys(covidVariants).value((d, k) => d[k]);

    if(colorMap == null) {
        colorMap = buildMapper(
            covidVariants.map((v) => {return {"strain": v}}), "strain", COLOR_LIST, categoryDomain
        );
    }

    d3.select(selector).selectAll("*").remove();
    let areaPlot = makePlotArea(selector, {
        yScaler: d3.scaleLinear,
        xScaler: d3.scaleTime,
        xDomain: getRawDomain([data.week[0], data.week[data.week.length - 1]]),
        yDomain: getRawDomain([0, 100]),
        dataList: [listData],
        legendOpacity: 1,
        width: 450,
        height: 300,
        margins: {top: 20, right: 30, bottom: 60, left: 50},
        title: title,
        yLabel: "Percent of Sequences",
        xLabel: "Time of Sequencing",
        labelSize: 15,
        titleSize: 20,
        interactive: true,
        zoomExtents: [1, 5],
        onZoomOrPan: (evt) => {
            areaPlot.xAxis.selectAll("text").style("text-anchor", "start").attr("transform", "rotate(40)");
        }
    });

    areaPlot.xAxis.selectAll("text").style("text-anchor", "start").attr("transform", "rotate(40)");
    let areas = areaPlot.plotArea.append("g").selectAll("areas")
        .data(stackGen(listData))
        .enter()
        .append("path")
        .attr("fill", (d, i) => colorMap(covidVariants[i]))
        .attr("d", d3.area()
            .x((d, i) => areaPlot.xProj(d.data.week))
            .y0((d) => areaPlot.yProj(d[0]))
            .y1((d) => areaPlot.yProj(d[1]))
        );

    let hoverLine = areaPlot.plotArea.append("line")
        .attr("display", "none")
        .attr("stroke", "white")
        .attr("stroke-width", "2px")
        .attr("pointer-events", "none");

    addHover("#tooltip", areas,
        (tooltip, d, item, evt) => {
            item.attr("stroke", "red").attr("stroke-width", "2px");
            item.raise();
            hoverLine.attr("display", "inline");
        },
        (tooltip, d, item) => {
            hoverLine.attr("display", "none");
            item.attr("stroke", "none");
        },
        (tooltip, d, item, evt) => {
            let [x, y] = d3.pointer(evt);

            let exactTime = areaPlot.xProj.invert(x);
            let idx = getSubIndex(data, null, areaPlot.xProj.invert(x), 1);
            let [diff1, diff2] = [data.week[idx] - exactTime, exactTime - data.week[idx - 1]];
            idx = (diff1 < diff2)? idx: idx - 1;
            x = areaPlot.xProj(data.week[idx]);

            hoverLine.attr("x1", x).attr("x2", x).attr("y1", 0).attr("y2", areaPlot.height);

            tooltip.selectAll("*").remove();

            let table = d3.create("table");
            table.html("<caption>" + PRINT_TIME(data.week[idx]) + "</caption><tr><th>Variant</th><th>Count</th></tr>");

            grabCountryDataForTime(data, null, data.week[idx], false).sort(
                (a, b) => b.count - a.count
            ).filter((d2) => d2.count > 0).forEach(
                (d2) => {
                    let tr = table.append("tr").html("<td><span class='dot'></span>" + d2.variant + "</td><td>" + d2.count + "</td>");
                    tr.select(".dot").style("background-color", colorMap(d2.variant));
                }
            );

            tooltip.append(() => table.node());
        }
    );

    areas.on("click", (evt, d) => {
        SELECTED_VARIANT.name = d.key;
        SELECTED_VARIANT.triggerUpdate();
    });

    return areaPlot;
}

let SELECTED_COUNTRY = {
    name: null,
    item: null
};

let SELECTED_VARIANT = {
    name: "Other",
    triggerUpdate: () => {}
}

async function updateWorldPlot(worldPlot, data, world, sliderIndex = 0) {
    d3.select("#figure1date").text("Date: " + PRINT_TIME(data.totals.week[sliderIndex]));

    let covidVariants = Object.keys(data.totals).filter((v) => (
        v !== "total_sequences" && v !== "week" && v !== "Other"
    ));
    covidVariants.push("Other");

    d3.select("figure1control")
        .attr("min", 0)
        .attr("max", data.totals.week.length - 1)
        .attr("step", 1)
        .attr("value", sliderIndex);

    let colorMap = buildMapper(covidVariants.map((v) => {return {"strain": v}}), "strain", COLOR_LIST, categoryDomain);

    let selectoRects = {};

    addLegend(worldPlot, {
        legendNames: covidVariants,
        legendColors: colorMap.colorList,
        legendLocation: "outside_center_right",
        legendTextSize: 11,
        onEnter: (evt) => d3.select(evt.target).attr("stroke", "red"),
        onExit: (evt, name) => {
            if(SELECTED_VARIANT.name !== name) d3.select(evt.target).attr("stroke", "black")
        },
        onClick: (evt, name) => {
            SELECTED_VARIANT.name = name;
            SELECTED_VARIANT.triggerUpdate();
        },
        onAddRect: (r, name) => (selectoRects[name] = r)
    });

    addHover(
        "#tooltip",
        worldPlot.worldData,
        (tooltip, d, elem) => {
            elem.attr("stroke", "red");
            if(SELECTED_COUNTRY.item != null) SELECTED_COUNTRY.item.raise();
            elem.raise();

            tooltip.selectAll("*").remove();

            if(!(d.properties.name in data.countries)) {
                tooltip.style("display", "none");
                return;
            }

            tooltip.style("display", "block");
            let table = d3.create("table");

            let subData = grabCountryDataForTime(data, d.properties.name, data.totals.week[sliderIndex], false);
            table.html("<caption>" + d.properties.name + "</caption><tr><th>Variant</th><th>Count</th></tr>");

            subData.sort((a, b) => b.count - a.count).filter((d2) => d2.count > 0).forEach((d2) => {
                let tr = table.append("tr").html("<td><span class='dot'></span>" + d2.variant + "</td><td>" + d2.count + "</td>");
                tr.select(".dot").style("background-color", colorMap(d2.variant));
            });

            tooltip.append(() => table.node());
        },
        (tooltip, d, elem) => {
            if(SELECTED_COUNTRY.name !== d.properties.name) elem.attr("stroke", "white");
        });

    worldPlot.worldData.each(function (d) {
        if(d.properties.name in data.countries) {
            let countryData = grabCountryDataForTime(data, d.properties.name, data.totals.week[sliderIndex], false);
            let maxLoc = {"count": -Infinity}
            for(let variant of countryData) if(variant.count > maxLoc.count) maxLoc = variant;
            d3.select(this).transition(200).attr("fill", colorMap(maxLoc.variant));
        }
    });

    worldPlot.worldData.on("click", (evt, d) => {
        if(!(d.properties.name in data.countries)) return;

        if(SELECTED_COUNTRY.name === d.properties.name) {
            SELECTED_COUNTRY.item.attr("stroke", "white").attr("stroke-width", "0.5");
            SELECTED_COUNTRY.name = (SELECTED_COUNTRY.item = null);
        }
        else {
            if(SELECTED_COUNTRY.item != null) SELECTED_COUNTRY.item.attr("stroke", "white").attr("stroke-width", "0.5");
            SELECTED_COUNTRY.name = d.properties.name;
            SELECTED_COUNTRY.item = d3.select(evt.target);
            SELECTED_COUNTRY.item.attr("stroke", "red").attr("stroke-width", "3px");
        }

        updateAreaPlot(
            "#figure2",
            (SELECTED_COUNTRY.name == null)? data.totals: data.countries[SELECTED_COUNTRY.name],
            "COVID-19 Variants over Time (" + ((SELECTED_COUNTRY.name == null)? "Worldwide": SELECTED_COUNTRY.name) + ")",
            colorMap
        );
        SELECTED_VARIANT.triggerUpdate();
    });

    SELECTED_VARIANT.triggerUpdate = function() {
        let title = this.name + " Variant Prevalence " + ((SELECTED_COUNTRY.name != null)? SELECTED_COUNTRY.name: "Worldwide")
        updateLinePlot(
            "#figure3",
            (SELECTED_COUNTRY.name == null)? data.totals: data.countries[SELECTED_COUNTRY.name],
            this.name,
            title,
            colorMap(this.name)
        );
        Object.values(selectoRects).forEach((r) => r.attr("stroke-width", "1px").attr("stroke", "black"));
        selectoRects[this.name].attr("stroke-width", "2px").attr("stroke", "red");
    }

    updateAreaPlot(
        "#figure2",
        (SELECTED_COUNTRY.name == null)? data.totals: data.countries[SELECTED_COUNTRY.name],
        "COVID-19 Variants over Time\n(" + ((SELECTED_COUNTRY.name == null)? "Worldwide": SELECTED_COUNTRY.name) + ")",
        colorMap
    );
    SELECTED_VARIANT.triggerUpdate();
}

let PLAYING = false
let SPEED = 300;
let TIMEOUT = null;

async function makePlots() {
    let [data, world] = await Promise.all([getFrequencies(), d3.json("data/world.json")]);

    let dateSlider = d3.select("#figure1control");
    dateSlider
        .attr("min", 0)
        .attr("max", data.totals.week.length - 1)
        .attr("step", 1)
        .attr("value", data.totals.week.length - 1);

    dateSlider.on("input", (evt) => updateWorldPlot(worldPlot, data, world, evt.target.value));

    function doUpdate() {
        if(PLAYING) {
            let newVal = (+dateSlider.property("value") + 1) % (+dateSlider.attr("max") + 1);
            dateSlider.property("value", newVal);
            if(newVal <= +dateSlider.attr("max")) updateWorldPlot(worldPlot, data, world, newVal);

            if(newVal >= dateSlider.attr("max")) {
                PLAYING = false;
                playPauseButton.text("▶");
            }
            else {
                TIMEOUT = setTimeout(doUpdate, SPEED);
            }
        }
    }

    let playPauseButton = d3.select("#playbutton");
    playPauseButton.on("click", (evt) => {
        let btn = d3.select(evt.target)
        let wasPlaying = btn.text() === "⏸";
        PLAYING = !wasPlaying;
        btn.text((PLAYING)? "⏸": "▶");

        if(PLAYING) {
            setTimeout(doUpdate, SPEED);
        }
        else {
            clearTimeout(TIMEOUT);
        }
    });

    let worldPlot = geoPlot(
        "#figure1", world, [0, 30], 104, "Most Common COVID-19 Variant by Region",
        {plotSize: [700, 400], projection: "geoMercator", interactive: true,
            translateExtent: [[-700 * 0.25, -400 * 0.25], [700 * 1.25, 400 * 1.25]]}
    );

    worldPlot.plotArea.append("use").attr("id", "hoverIndicator");
    updateWorldPlot(worldPlot, data, world, data.totals.week.length - 1);
}

window.onload = makePlots;
