const margin = {
    left: 50, right: 50, top: 50, bottom: 50
}
const svgWidth = 900;
const svgHeight = 600;
const width = svgWidth - margin.left - margin.right;
const height = svgHeight - margin.top - margin.bottom;

const svg = d3
.select('#svg-container')
.append('svg')
.attr('width', svgWidth)
.attr('height', svgHeight)
.append('g')
.attr('transform', `translate(${margin.left}, ${margin.top})`)
.style('user-select', 'none')

// gets a geopath function from d3
// this generates paths based on the data provided
const path = d3.geoPath();

// available schemes
const schemes = [d3.schemeYlGnBu[9], d3.schemeOrRd[9]];
let currentScheme = 0;

// bool for whether boundaries are visible
let boundariesVisible = false;

// creates a color scale with a threshold scale
const color = d3.scaleThreshold()
.domain([1, 10, 50, 200, 500, 1000, 2000, 4000])
.range(schemes[currentScheme]);

// creates the key / legend scale for the rectangles and axes positions
const scale = d3.scaleSqrt()
.domain([0, 4500])
.rangeRound([440, 950]);

const key = svg.append('g')
.attr('class', 'key')

// creates the colored rects of the legend
key
.selectAll('rect')
.data(color.range().map((d) => {
    d = color.invertExtent(d);
    if (!d[0]) {
        d[0] = scale.domain()[0];
    }
    if (!d[1]) {
        d[1] = scale.domain()[1];
    }
    return d;
}))
.enter()
.append('rect')
.attr('height', 8)
.attr('x', (d) => {
    return scale(d[0]);
})
.attr('width', (d) => { return scale(d[1]) - scale(d[0]); })
.attr('fill', (d) => { return color(d[0]); });

// creates label for the legend
key
.append('text')
.attr('class', 'caption')
.attr('x', scale.range()[0])
.attr('y', -6)
.attr('fill', 'black')
.attr('text-anchor', 'start')
.attr('font-weight', 'bold')
.text('Population per square mile');

// creates axis for the legend
key
.call(
    d3.axisBottom(scale)
    .tickSize(13)
    .tickValues(color.domain())
)
// remove the long axis line
.select('.domain')
.remove();

// creates a container for buttons as a child of svg-container 
const options = d3.select('#svg-container')
.append('div')
.attr('class', 'options')
.style('right', 0)
.style('top', 80)

// json from https://d3js.org/us-10m.v1.json
// referenced from https://bl.ocks.org/mbostock/4122298
d3.json('us-10m.v1.json').then(async (data) => {

    const stateName = 'Kentucky';

    // read csv data of population density and store information based on county id
    const countyIdMap = {};
    await d3.csv('Population-Density By County.csv', (d) => {

        // ignore data if it is not the state we want
        if (d['GEO.display-label'] !== stateName) {
            return;
        }

        // get the county name and density
        const name = d['GCT_STUB.display-label'];
        const density = +d['Density per square mile of land area'];

        // store the information into a countyIdMap to be accessed by id later
        const id = d['GCT_STUB.target-geo-id2'];
        countyIdMap[id] = {
            id,
            name,
            density
        };
    });

    // remove all county geometry that is not apart of this state
    data.objects.counties.geometries = data.objects.counties.geometries.filter((d) => countyIdMap[d.id])

    const stateScale = 6;

    // transform the map to focus on the specified state, hardcoded
    const map = svg.append('g').attr('transform', `translate(${-605 * stateScale}, ${-265 * stateScale}) scale(${stateScale})`);

    // gets reference to the tooltip element
    const tooltip = d3.select('#tooltip')

    const boundaryColor = 'black';
    const boundaryOpacity = .3;

    // creates a container for counties
    const counties = map.append('g')
    .attr('class', 'counties')
    
    // creates the paths for each county
    counties.selectAll('path')
    .data(topojson.feature(data, data.objects.counties).features)
    .enter()
    .append('path')
    .attr('stroke-width', 2 / stateScale)
    .attr('stroke-opacity', boundaryOpacity)
    .attr('d', path)
    // adds mouse events to each county for displaying the tooltip
    .on('mouseover', (d, i, nodes) => {
        const node = d3.select(nodes[i]);
        node.remove();
        counties.nodes()[0].appendChild(nodes[i]);

        node.attr('stroke', 'white')
        .attr('stroke-opacity', 1)
        
        const {name, density} = countyIdMap[d.id];
        tooltip.select('#name').text(name)
        tooltip.select('#label').text('Density:')
        tooltip.select('#density').text(density + ' / sq mi')
        tooltip.style('display', 'block');
    })
    .on('mousemove', () => {
        const e = d3.event;
        tooltip
        .style('left', e.clientX + 5)
        .style('top', e.clientY - 45)
    })
    .on('mouseout', (d, i, nodes) => {
        const node = d3.select(nodes[i]);
        node.attr('stroke', boundariesVisible && boundaryColor)
        .attr('stroke-opacity', boundaryOpacity)
        tooltip.style('display', 'none');
    })
    
    // create an update function that updates the colors
    const updateCallback = () => {

        // select all paths in counties and set the fill and boundary
        counties
        .selectAll('path')
        .attr('fill', (d) => {
            const {density} = countyIdMap[d.id]; 
            return color(density);
        })
        .attr('stroke', boundariesVisible ? boundaryColor : 'none')
    }

    updateCallback();

    // creates buttons in options for changing the theme and boundary visibility
    options
    .append('button')
    .attr('class', 'theme-button')
    .text('Color')
    .on('click', () => {
        if (currentScheme >= schemes.length - 1) {
            currentScheme = 0;
        } else {
            currentScheme += 1;
        }
        color.range(schemes[currentScheme]);
        updateCallback();
    })

    options
    .append('button')
    .text('Toggle County Boundary')
    .on('click', () => {
        boundariesVisible = !boundariesVisible;
        updateCallback();
    })
})