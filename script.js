var vid, playbtn, seekslider, curtimetext, durtimetext;

function initializePlayer() {
  vid = document.getElementById("my_video");
  playbtn = document.getElementById("play/pausebutton");
  seekslider = document.getElementById("seekslider");
  durtimetext = document.getElementById("durtimetext");
  curtimetext = document.getElementById("curtimetext");
  playbtn.addEventListener("click", playPause, false);
  seekslider.addEventListener("change", vidSeek, false);
  vid.addEventListener("timeupdate", seektimeupdate, false);
}

window.onload = function () {
  initializePlayer();
  drawVisualization();
};

function playPause() {
  if (vid.paused) {
    vid.play();
    playbtn.innerHTML = "Pause";
  } else {
    vid.pause();
    playbtn.innerHTML = "Play";
  }
}

function vidSeek() {
  var seekto = vid.duration * (seekslider.value / 100);
  vid.currentTime = seekto;
}

function seektimeupdate() {
  var nt = vid.currentTime * (100 / vid.duration);
  seekslider.value = nt;
  var curmins = Math.floor(vid.currentTime / 60);
  var cursecs = Math.floor(vid.currentTime - curmins * 60);
  var durmins = Math.floor(vid.duration / 60);
  var dursecs = Math.round(vid.duration - durmins * 60);
  if (cursecs < 10) {
    cursecs = "0" + cursecs;
  }
  if (dursecs < 10) {
    dursecs = "0" + dursecs;
  }
  curtimetext.innerHTML = curmins + ":" + cursecs;
  durtimetext.innerHTML = durmins + ":" + dursecs;

  var shotDataMap = new Map(); // Global map to hold shot data with colors

  Promise.all([
    d3.csv("./data/sample_scene-Scenes.csv"), // Load scene data
    d3.csv("./data/shot_type.csv"), // Load shot type data
    d3.csv("./data/shot_type_reference.csv"), // Load shot type color reference data
  ]).then(function ([sceneData, shotTypeData, colorData]) {
    // Create the color mapping
    var shotTypeColors = {};
    colorData.forEach(function (d) {
      shotTypeColors[d["Shot Type"]] = d["Color"];
    });

    // Map each scene to its shot type and color
    shotTypeData.forEach(function (d) {
      var color = shotTypeColors[d["Shot Type"]];
      shotDataMap.set(d["Scene Number"], {
        type: d["Shot Type"],
        color: color,
      });
    });

    // Additional setup, if required

    var currentScene = sceneData.find(
      (scene) =>
        vid.currentTime >= parseFloat(scene["Start Time (seconds)"]) &&
        vid.currentTime < parseFloat(scene["End Time (seconds)"])
    );

    var shotTextElement = document.getElementById("shot_type_text");
    var videoElement = document.getElementById("my_video");

    if (currentScene) {
      var sceneNumber = currentScene["Scene Number"];
      var shotInfo = shotDataMap.get(sceneNumber);
      if (shotInfo) {
        videoElement.style.border = `4px solid ${shotInfo.color}`;
        shotTextElement.textContent = `Shot Type: ${shotInfo.type}`;
        shotTextElement.style.color = shotInfo.color;
      }
    } else {
      videoElement.style.border = "4px solid transparent";
      shotTextElement.textContent = "Shot Type: None";
      shotTextElement.style.color = "initial";
    }
  });
  d3.csv("./data/sample_scene-Scenes.csv").then(function (data) {
    //Highlight the shot bar if the current time is within the shot's range
    data.forEach((d, i) => {
      const startTime = parseFloat(d["Start Time (seconds)"]);
      const endTime = parseFloat(d["End Time (seconds)"]);
      // Select the bar using a unique identifier, e.g., an ID
      var bar = d3.select("#shot-bar-" + i);

      // Check if the current time is within the shot's range
      if (vid.currentTime >= startTime && vid.currentTime <= endTime) {
        bar.attr("opacity", 1); // Highlight the active shot bar
      } else {
        bar.attr("opacity", 0.3); // Revert to the original color if not active
      }
    });
  });
}

function drawVisualization() {
  // Assuming the seekslider is already in the DOM and has a defined width
  var seekBarWidth = document.getElementById("seekslider").offsetWidth;
  var svg = d3
    .select("#visualization")
    .attr("width", seekBarWidth)
    .attr("height", 20); // Set a fixed height for the SVG

  Promise.all([
    d3.csv("./data/sample_scene-Scenes.csv"), // Load scene data
    d3.csv("./data/shot_type.csv"), // Load shot type data
    d3.csv("./data/shot_type_reference.csv"), // Load shot type color reference data
  ]).then(function ([sceneData, shotTypeData, colorData]) {
    // Process the color data into a mapping
    var shotTypeColors = {};
    colorData.forEach(function (d) {
      shotTypeColors[d["Shot Type"]] = d["Color"];
    });

    // Add color info to shotTypeData
    shotTypeData.forEach(function (shot) {
      shot.color = shotTypeColors[shot["Shot Type"]];
    });

    // Create a map for quick lookup
    var shotDataMap = new Map(
      shotTypeData.map((shot) => [shot["Scene Number"], shot])
    );

    // Compute the maximum end time to scale the width of the bars
    const maxEndTime = Math.max(
      ...sceneData.map((d) => parseFloat(d["End Time (seconds)"]))
    );

    // Scales - map the maxEndTime to the width of the seek bar
    const xScale = d3
      .scaleLinear()
      .domain([0, maxEndTime])
      .range([0, seekBarWidth]);
    // Now draw the visualization using the xScale for the x-axis
    sceneData.forEach((d, i) => {
      const startTime = parseFloat(d["Start Time (seconds)"]);
      const endTime = parseFloat(d["End Time (seconds)"]);
      const sceneWidth = xScale(endTime - startTime);
      const xOffset = xScale(startTime);

      // Get color based on shot type
      const shotInfo = shotDataMap.get(d["Scene Number"]);
      const color = shotInfo ? shotInfo.color : "#C49A6C"; // Default color if not found

      // Append a bar for each scene
      svg
        .append("rect")
        .attr("id", "shot-bar-" + i)
        .attr("x", xOffset)
        .attr("y", 0)
        .attr("width", sceneWidth)
        .attr("height", 50)
        .attr("fill", color)
        .attr("stroke", "black")
        .attr("opacity", 1)
        .attr("stroke-width", 1);
    });
  });
}

// Assuming your data is stored in a variable called `movements`

const movementDescriptions = {
  1: {
    type: "truck",
    direction: "left to right",
    start: [50, 50],
    end: [100, 50],
  },
  2: {
    type: "truck",
    direction: "right to left",
    start: [50, 50],
    end: [0, 50],
  },
  3: { type: "dolly", direction: "forwards", start: [50, 50], end: [50, 0] },
  4: { type: "dolly", direction: "backwards", start: [50, 50], end: [50, 100] },
};

const movements = [
  { timeStart: 0, timeEnd: 2, movementId: "1" },
  { timeStart: 3, timeEnd: 10, movementId: "2" },
  { timeStart: 11, timeEnd: 13, movementId: "4" },
  { timeStart: 14, timeEnd: 20, movementId: "3" },
  { timeStart: 20, timeEnd: 23, movementId: "1" },
  { timeStart: 23, timeEnd: 30, movementId: "4" },
  { timeStart: 30, timeEnd: 34, movementId: "4" },
  { timeStart: 34, timeEnd: 40, movementId: "2" }, // Assuming these refer to the same type of movement as in `movementDescriptions`
];

function combineMovementData(movements, descriptions) {
  return movements.map((movement) => {
    const description = descriptions[movement.movementId];
    // Combine the time-based record with its corresponding description
    return { ...movement, ...description };
  });
}

const combinedMovements = combineMovementData(movements, movementDescriptions);

// Calculate duration for each movement
combinedMovements.forEach((movement) => {
  movement.duration = (movement.timeEnd - movement.timeStart) * 1000; // Convert to milliseconds if needed
});

let svg2 = d3.select("#drawlines").attr("width", 800).attr("height", 600);

// Create a scale for line thickness based on duration
const thicknessScale = d3
  .scaleLinear()
  .domain([
    d3.min(combinedMovements, (d) => d.duration),
    d3.max(combinedMovements, (d) => d.duration),
  ])
  .range([1, 5]); // Adjust the range for min and max thickness as needed

// Assuming d3 is already included in your environment

// Adjusted to add a delay based on timeStart
combinedMovements.forEach((movement) => {
  const delay = movement.timeStart * 1000; // Convert to milliseconds if necessary

  svg2
    .append("line")
    .attr("x1", movement.start[0])
    .attr("y1", movement.start[1])
    .attr("x2", movement.start[0]) // Start with x2 and y2 at the initial position
    .attr("y2", movement.start[1])
    .attr("stroke", "black")
    .attr("stroke-width", thicknessScale(movement.duration))
    .attr("stroke-opacity", 0.3) // Adjust as needed for visual distinction
    .transition()
    .delay(delay) // Delay the start of the animation based on timeStart
    .duration(movement.duration) // Use the calculated duration for the transition
    .attr("x2", movement.end[0]) // Animate to the final position
    .attr("y2", movement.end[1]);
});
