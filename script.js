var vid, playbtn, seekslider, curtimetext, durtimetext;
var movements = []; // This will hold the parsed data once it's loaded
var colorData = []; // To hold color data

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

// Load color data
d3.csv("./data/color_data.csv").then(function (data) {
  colorData = data.map((d) => ({
    start_time: +d["Start Time"],
    end_time: +d["End Time"],
    colors: [
      d["Dominant Color"],
      d["Color 1"],
      d["Color 2"],
      d["Color 3"],
      d["Color 4"],
    ],
  }));
  // No need for an onDataLoaded call here unless you need to initialize something specific to color data
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
  updateColorVisualization(vid.currentTime);

  var shotDataMap = new Map(); // Global map to hold shot data with colors

  Promise.all([
    d3.csv("./data/sample_scene-Scenes.csv"), // Load scene data
    d3.csv("./data/shot_type.csv"), // Load shot type data
    d3.csv("./data/shot_type_reference.csv"), // Load shot type color reference data
  ]).then(function ([sceneData, shotTypeData, colorData]) {
    // Create the color and size mapping
    var shotTypeDetails = {};
    colorData.forEach(function (d) {
      shotTypeDetails[d["Shot Type"]] = { color: d["Color"], size: +d["size"] };
    });

    // Create a map for quick lookup of shot types to scene numbers
    var shotDataMap = new Map();

    // Map each scene to its shot type, color, and size
    shotTypeData.forEach(function (d) {
      var details = shotTypeDetails[d["Shot Type"]];
      shotDataMap.set(d["Scene Number"], {
        type: d["Shot Type"],
        color: details.color,
        size: details.size,
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
        var strokeSize = shotInfo.size || 4; // Default to 4 if size is not defined
        // videoElement.style.border = `${strokeSize / 2}px solid ${
        //   shotInfo.color
        // }`;
        shotTextElement.textContent = `Shot Type: ${shotInfo.type}`;
        // shotTextElement.style.color = shotInfo.color;
      }
    } else {
      // videoElement.style.border = "none";
      shotTextElement.textContent = "Shot Type: None";
      // shotTextElement.style.color = "initial";
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
  var svgHeight = 200;
  var svg = d3
    .select("#visualization")
    .attr("width", seekBarWidth)
    .attr("height", svgHeight); // Set a fixed height for the SVG

  Promise.all([
    d3.csv("./data/sample_scene-Scenes.csv"), // Load scene data
    d3.csv("./data/shot_type.csv"), // Load shot type data
    d3.csv("./data/shot_type_reference.csv"), // Load shot type color reference data
  ]).then(function ([sceneData, shotTypeData, colorData]) {
    // Process the color and size data into a mapping
    var shotTypeInfo = {};
    colorData.forEach(function (d) {
      shotTypeInfo[d["Shot Type"]] = { color: d["Color"], size: +d["size"] };
    });

    // Add color and size info to shotTypeData
    shotTypeData.forEach(function (shot) {
      var info = shotTypeInfo[shot["Shot Type"]];
      shot.color = info ? info.color : "#C49A6C"; // Default color if not found
      shot.size = info ? info.size : 20; // Default size if not found
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

      // Get color and size based on shot type
      const shotInfo = shotDataMap.get(d["Scene Number"]);
      const color = shotInfo ? shotInfo.color : "#C49A6C"; // Default color if not found
      const height = shotInfo ? shotInfo.size : 20; // Use size for height

      const yOffset = (svgHeight - height) / 2; // Centers the rectangle
      // Append a bar for each scene
      svg
        .append("rect")
        .attr("id", "shot-bar-" + i)
        .attr("x", xOffset)
        .attr("y", yOffset)
        .attr("width", sceneWidth)
        .attr("height", height)
        .attr("fill", "white")
        .attr("stroke", "black")
        .attr("opacity", 1)
        .attr("stroke-width", 1);
    });
  });
}

var svgWidth = +d3.select("#movement").attr("width");
var svgHeight = +d3.select("#movement").attr("height");

var bgRect = d3
  .select("#movement")
  .insert("rect", ":first-child") // Ensure the rectangle is the first child of the SVG
  .attr("width", svgWidth)
  .attr("height", svgHeight)
  .attr("fill", "black") // Set your desired background color here
  .style("fill-opacity", 0.5); // Set the opacity here (range: 0 to 1)

var svg3 = d3.select("#movement");
// function startBlinkingEffect() {
//   var rect = d3.select("#rectangle");

//   // Function to toggle the opacity
//   function blink() {
//     rect
//       .transition()
//       .duration(800) // Duration of one phase of the blinking, in milliseconds
//       .attr("opacity", 0) // Make the rectangle fully transparent
//       .transition()
//       .duration(800)
//       .attr("opacity", 1) // Make the rectangle fully opaque
//       .on("end", blink); // When one cycle completes, start the next
//   }

//   blink(); // Start the blinking effect
// }

var traceLayer = svg3.append("g").attr("id", "traceLayer");

svg3
  .append("rect")
  .attr("id", "rectangle")
  .attr("x", 130) // Starting x position
  .attr("y", 150) // Starting y position
  .attr("width", 30) // Width of the rectangle
  .attr("height", 30) // Height of the rectangle
  .attr("fill", "white"); // Fill color of the rectangle

// After setting up the rectangle
// startBlinkingEffect();

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
  x: 130,
  y: 150,
  initialTranslateX: 0,
  initialTranslateY: 0,
  initialScaleX: 1,
  initialScaleY: 1,
  width: 30,
  height: 30,
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
  rectState.x = 130; // Or any scene-specific starting position
  rectState.y = 150; // Or any scene-specific starting position

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

var recordInterval = setInterval(recordAndDrawRectangle, 1000);

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
      var totalTranslation = movement.Distance * 50; // Adjust multiplier as needed for your scale
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
    transform = `translate(${centerX}, ${centerY}) scale(${rectState.scaleX}, ${
      rectState.scaleY
    }) translate(${-centerX}, ${-centerY})`;
  } else {
    // Default transformation for "Dolly", "Pan", and others
    transform = `translate(${rectState.translateX}, ${
      rectState.translateY
    }) rotate(${rectState.rotate}, ${rectState.x + rectState.width / 2}, ${
      rectState.y + rectState.height / 2 + 20
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
  rect.attr("transform", "translate(130, 150)"); // Assuming these are the initial x and y positions
  // You may also reset scale and rotation if they've been changed from the initial state
  // For example, if you initially had a scale or rotation applied:
  // rect.attr("transform", "translate(100, 50) scale(1) rotate(0)");
}

function updateColorVisualization(currentTime) {
  var svg = d3.select("#color");
  svg.selectAll("*").remove(); // Clear existing visualization

  var currentColorData = colorData.find(
    (d) => currentTime >= d.start_time && currentTime < d.end_time
  );
  if (currentColorData) {
    // Draw dominant color circle
    svg
      .append("circle")
      .attr("cx", 50)
      .attr("cy", 100)
      .attr("r", 40)
      .style("stroke", "white")
      .style("fill", currentColorData.colors[0]);

    // Draw smaller circles for other colors
    currentColorData.colors.slice(1).forEach((color, index) => {
      svg
        .append("circle")
        .attr("cx", 150 + index * 60)
        .attr("cy", 100)
        .attr("r", 20)
        .style("stroke", "white")
        .style("fill", color);
    });
  }
}
