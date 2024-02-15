var vid, playbtn, seekslider, curtimetext, durtimetext;
var movements = []; // This will hold the parsed data once it's loaded

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

function onDataLoaded() {
  // Code that depends on `globalMovements` goes here
  console.log(movements); // Now it's safe to use the data
  initializePlayer();
}

d3.csv("./data/camera_movement_data.csv").then(function (data) {
  movements = data.map((d) => ({
    Movement: +d.Movement,
    start_time: +d.start_time,
    end_time: +d.end_time,
    Type: d.Type,
    Distance: +d.Distance,
    Direction: d.Direction,
    Scene: +d.Scene,
  }));
  onDataLoaded();
});

console.log(movements);

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

  updateAnimation(vid.currentTime);

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

var svg3 = d3.select("#movement")
  .style("border", "0.5px solid white") // Set the border color and width
  .style("border-radius", "4px");


function startBlinkingEffect() {
  var rect = d3.select("#rectangle");

  // Function to toggle the opacity
  function blink() {
    rect
      .transition()
      .duration(800) // Duration of one phase of the blinking, in milliseconds
      .attr("opacity", 0) // Make the rectangle fully transparent
      .transition()
      .duration(800)
      .attr("opacity", 1) // Make the rectangle fully opaque
      .on("end", blink); // When one cycle completes, start the next
  }

  blink(); // Start the blinking effect
}

var traceLayer = svg3.append("g").attr("id", "traceLayer");

svg3
  .append("rect")
  .attr("id", "rectangle")
  .attr("x", 150) // Starting x position
  .attr("y", 180) // Starting y position
  .attr("width", 50) // Width of the rectangle
  .attr("height", 50) // Height of the rectangle
  .attr("fill", "#B2B2B2"); // Fill color of the rectangle

// After setting up the rectangle
startBlinkingEffect();

// var rectState = {
//   scaleX: 1,
//   scaleY: 1,
//   translateX: 100,
//   translateY: 20,
//   rotate: 0,
// };
// var traceLayer = d3.select("#movement").append("g").attr("id", "traceLayer");

var rectState = {
  // Initial state and current scene
  x: 150,
  y: 180,
  initialTranslateX: 0,
  initialTranslateY: 0,
  initialScaleX: 1,
  initialScaleY: 1,
  width: 50,
  height: 50,
  scaleX: 1,
  scaleY: 1,
  initialRotate: 0,
  translateX: 0,
  translateY: 0,
  currentScene: null,
  currentMovement: null,
  currentMovementType: null, // Add this line
  postScaleTranslateX: 0,
  postScaleTranslateY: 0,
};

// Define an offset for the text to appear above the rectangle
var textOffsetY = -10;
var textOffsetX = -80;

var movementText = svg3
  .append("text")
  .attr("x", rectState.x + textOffsetX) // Initial X position, same as rectangle
  .attr("y", rectState.y + textOffsetY) // Initial Y position, offset to be above the rectangle
  .attr("id", "movementText") // Assign an ID for easy selection later
  .style("font-size", "16px") // Set font size
  .style("fill", "white") // Set text color
  .text("Movement: None"); // Initial text

function resetTransformationsForNewScene() {
  // Reset transformation state for a new scene
  rectState.scaleX = 1;
  rectState.scaleY = 1;
  rectState.rotate = 0;
  rectState.translateX = 0;
  rectState.translateY = 0;

  // Optionally reset position
  rectState.x = 150; // Or any scene-specific starting position
  rectState.y = 180; // Or any scene-specific starting position

  // Apply reset transformations to the rectangle
  var rect = d3.select("#rectangle");
  rect.attr("transform", "");
  // Optionally, update position if changed
  rect.attr("x", rectState.x).attr("y", rectState.y);
  d3.select("#movementText").text("Movement: None"); // Reset text

  traceLayer.selectAll("*").remove(); // This line clears the traceLayer
}

function recordAndDrawRectangle() {
  var rect = d3.select("#rectangle");
  var transform = rect.attr("transform");

  // Parse the current transformation of the rectangle
  // Note: This assumes the transform attribute is directly applicable to a <rect>.
  // For more complex transformations, you might need to parse and calculate the absolute position.

  // Create a new rectangle in the trace layer with the same transformation
  traceLayer
    .append("rect")
    .attr("x", rect.attr("x"))
    .attr("y", rect.attr("y"))
    .attr("width", rect.attr("width"))
    .attr("height", rect.attr("height"))
    .attr("transform", transform)
    .attr("opacity", 0.3)
    .style("fill", "none") // Set to none or a light color to distinguish traces
    .style("stroke", "white");
}

var recordInterval = setInterval(recordAndDrawRectangle, 1500);

function applyTransformation(movement, progress) {
  rectState.currentMovementType = movement.Type;

  var movementTypeText = "Movement: " + movement.Type;
  d3.select("#movementText").text(movementTypeText);

  var rect = d3.select("#rectangle");

  if (rectState.currentScene !== movement.Scene) {
    resetTransformationsForNewScene(); // Reset if new scene
    rectState.currentScene = movement.Scene;
  }

  switch (movement.Type) {
    case "Boom":
      // Calculate the current scale factor based on the movement's progress
      var targetScale = movement.Distance;
      var currentScale =
        rectState.initialScaleX +
        (targetScale - rectState.initialScaleX) * progress;

      // Update the rectState scale
      rectState.scaleX = currentScale;
      rectState.scaleY = currentScale;

      // Center calculations should consider the current transformed position
      // No need for additional translation adjustments specifically for "Boom"
      // if the transformations are applied correctly in getTransformationString
      break;

    case "Dolly":
      if (
        rectState.currentScene !== movement.Scene ||
        rectState.currentMovement !== movement.Movement
      ) {
        // Capture the initial translation state at the start of the movement
        rectState.initialTranslateX = rectState.translateX;
        rectState.initialTranslateY = rectState.translateY;
        rectState.currentMovement = movement.Movement;
      }

      // Calculate the total intended translation based on the movement's Distance
      var totalTranslation = movement.Distance * 100; // Adjust multiplier as needed for your scale
      var translationDirectionMultiplier =
        movement.Direction === "out" ? 1 : -1;
      var currentTranslation =
        totalTranslation * translationDirectionMultiplier * progress;

      // Apply the translation based on progress from the initial state
      rectState.translateY = rectState.initialTranslateY + currentTranslation;
      break;

    case "Pan":
      if (
        rectState.currentScene !== movement.Scene ||
        rectState.currentMovement !== movement.Movement
      ) {
        // This is a new movement or scene, so capture the initial rotation state
        rectState.initialRotate = rectState.rotate;
        rectState.currentMovement = movement.Movement; // Track the current movement ID if not already present in rectState
      }

      // Calculate total rotation desired by the end of the movement
      var totalRotation =
        movement.Distance * (movement.Direction === "left" ? -45 : 45);

      // Calculate the rotation amount for the current progress
      var currentRotation = rectState.initialRotate + totalRotation * progress;

      // Apply only the difference needed to achieve the currentRotation
      rectState.rotate = currentRotation;

      break;
    case "stat":
      // Do nothing for the "Stay" case, leaving the rectangle as is
      break;
  }

  d3.select("#movementText")
    .attr("x", rectState.translateX + rectState.x + textOffsetX) // Update X to match rectangle's new position
    .attr("y", rectState.translateY + rectState.y + textOffsetY); // Update Y, considering offset

  rect.attr("transform", getTransformationString());
}

function getTransformationString() {
  let transform;

  if (rectState.currentMovementType === "Boom") {
    // Adjusted transformation for "Boom"
    var centerX = rectState.x + rectState.width / 2 + rectState.translateX;
    var centerY = rectState.y + rectState.height / 2 + rectState.translateY;
    transform = `translate(${centerX}, ${centerY}) scale(${rectState.scaleX}, ${rectState.scaleY
      }) translate(${-centerX}, ${-centerY})`;
  } else {
    // Default transformation for "Dolly", "Pan", and others
    transform = `translate(${rectState.translateX}, ${rectState.translateY
      }) rotate(${rectState.rotate}, ${rectState.x + rectState.width / 2}, ${rectState.y + rectState.height / 2 + 20
      }) scale(${rectState.scaleX}, ${rectState.scaleY})`;
  }
  return transform;
}

function updateAnimation(currentTime) {
  let movementFound = false;

  movements.forEach((movement) => {
    if (currentTime >= movement.start_time && currentTime < movement.end_time) {
      let progress =
        (currentTime - movement.start_time) /
        (movement.end_time - movement.start_time);
      applyTransformation(movement, progress);
      movementFound = true;
    }
  });

  if (!movementFound) {
    resetToInitialState();
    // console.log("static");
  }
}

function resetToInitialState() {
  var rect = d3.select("#rectangle");
  // Reset the rectangle to its initial attributes and transformation
  rect.attr("transform", "translate(150, 180)"); // Assuming these are the initial x and y positions
  // You may also reset scale and rotation if they've been changed from the initial state
  // For example, if you initially had a scale or rotation applied:
  // rect.attr("transform", "translate(100, 50) scale(1) rotate(0)");
}
