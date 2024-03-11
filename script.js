var vid, playbtn, seekslider, curtimetext, durtimetext;
var movements = []; // This will hold the parsed data once it's loaded
var colorData = []; // To hold color data
var scriptData = []; // This will hold the script data once it's loaded
var currentTimeLine;
var xScale; // Ensure xScale is accessible in seektimeupdate

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
  console.log(scriptData);
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
    Scene: +d.Shot,
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

d3.csv("./data/script_data.csv").then(function (data) {
  scriptData = data.map((d) => ({
    start_time: +d.start_time,
    end_time: +d.end_time,
    text_content: d.content,
    location2: d.location_2,
  }));
  // Assuming onDataLoaded is a function that might use scriptData
  onDataLoaded();
});

console.log(scriptData);

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

  var xPos = xScale(vid.currentTime); // Use xScale to get the new x position

  currentTimeLine.attr("x1", xPos).attr("x2", xPos);
  // Update the position of the current time indicator line

  // Determine the script content to display based on the current video time
  const currentScript = scriptData.find(
    (script) =>
      vid.currentTime >= script.start_time && vid.currentTime < script.end_time
  );

  // Select the SVG element meant for displaying the script
  var scriptSVG = d3.select("#script");
  // Ensure it's empty before appending new text content
  var setTextElement = document.getElementById("location2_text");

  if (currentScript) {
    // Clear the previous content
    scriptSVG.selectAll("*").remove();

    // Call wrapText with the script content and desired width
    wrapText(currentScript.text_content, 540); // Replace 300 with your actual width
    setTextElement.textContent = `${currentScript.location2}`; // Assuming 'set' is a property in your script data

    // Call this function after setting the text content
  } else {
    scriptSVG.selectAll("*").remove();
    scriptSVG.attr("height", 20); // Collapse the SVG if there's no content
    // If there's no script content for the current time, keep the script SVG empty
    // This will effectively make the text disappear
  }

  Promise.all([
    d3.csv("./data/sample_scene-Scenes.csv"), // Load scene data
    d3.csv("./data/shot_type.csv"), // Load shot type data
    d3.csv("./data/shot_type_reference.csv"), // Load shot type color reference data
    d3.csv("./data/script_data.csv"), // Load scene data
  ]).then(function ([sceneData, shotTypeData, colorData, scriptData]) {
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
      shotDataMap.set(d["Shot Number"], {
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
      var sceneNumber = currentScene["Shot Number"];
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

    sceneData.forEach((d, i) => {
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

    scriptData.forEach((d, i) => {
      const startTime = parseFloat(d["start_time"]);
      const endTime = parseFloat(d["end_time"]);
      // Select the bar using a unique identifier, e.g., an ID
      var bar = d3.select("#script-bar-" + i);

      // Check if the current time is within the shot's range
      if (vid.currentTime >= startTime && vid.currentTime <= endTime) {
        bar.attr("opacity", 1); // Highlight the active shot bar
      } else {
        bar.attr("opacity", 0.3); // Revert to the original color if not active
      }
    });
  });
}
//////////Timeline Visualization(shot, script, movement)////////////////////////////////
function wrapText(text, width) {
  var scriptSVG = d3.select("#script");
  // Create a foreign object
  var foreignObject = scriptSVG
    .append("foreignObject")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", width)
    .attr("height", 100); // Set height to a large enough value

  // Append a div to the foreign object
  var textDiv = foreignObject
    .append("xhtml:div")
    .attr("id", "textDiv")
    .style("font-size", "18px")
    .style("color", "white")
    .style("padding", "5px") // Optional: adds padding inside the text box
    // You can add more styling as needed here
    .html(text);

  // Adjust the height of the foreign object to the size of its content
  var divNode = textDiv.node();
  foreignObject.attr("height", divNode.getBoundingClientRect().height);

  updateScriptBoxSize();
}

function updateScriptBoxSize() {
  // Get the dimensions of the textDiv content
  var textDiv = document.getElementById("textDiv"); // Make sure you have an ID for your text div
  if (textDiv) {
    // var width = textDiv.offsetWidth;
    var height = textDiv.offsetHeight;

    // Now set the SVG dimensions to fit the content
    var scriptSVG = document.getElementById("script"); // Your SVG element
    if (scriptSVG) {
      // scriptSVG.setAttribute("width", width + 20); // You might want to add some padding
      scriptSVG.setAttribute("height", height + 20);

      // Also update the foreignObject dimensions if you're using it
      var foreignObject = scriptSVG.querySelector("foreignObject");
      if (foreignObject) {
        // foreignObject.setAttribute("width", width);
        foreignObject.setAttribute("height", height);
      }
    }
  }
}

function drawVisualization() {
  // Assuming the seekslider is already in the DOM and has a defined width
  var seekBarWidth = document.getElementById("seekslider").offsetWidth;
  var svgHeight = 300;
  var svg = d3
    .select("#visualization")
    .attr("width", seekBarWidth)
    .attr("height", svgHeight); // Set a fixed height for the SVG

  svg
    .append("image")
    .attr("x", 0) // The x position of the image within the SVG
    .attr("y", 0) // The y position of the image within the SVG
    .attr("width", seekBarWidth) // The width of the image
    .attr("height", 80) // The height of the image
    .attr("xlink:href", "./combined_sorted_image.png") // The path to your PNG image
    .attr("preserveAspectRatio", "none"); // This will stretch the image
  const maxEndTime = Math.max(
    ...movements.map((d) => d.end_time) // Use movements data for maxEndTime
  );

  xScale = d3.scaleLinear().domain([0, maxEndTime]).range([0, seekBarWidth]);

  Promise.all([
    d3.csv("./data/sample_scene-Scenes.csv"), // Load scene data
    d3.csv("./data/shot_type.csv"), // Load shot type data
    d3.csv("./data/shot_type_reference.csv"), // Load shot type color reference data
    d3.csv("./data/script_data.csv"), // Load scene data
  ]).then(function ([sceneData, shotTypeData, colorData, scriptData]) {
    // Process the color and size data into a mapping
    var shotTypeInfo = {};
    colorData.forEach(function (d) {
      shotTypeInfo[d["Shot Type"]] = { color: d["Color"], size: +d["size"] };
    });

    // Add color and size info to shotTypeData
    shotTypeData.forEach(function (shot) {
      var info = shotTypeInfo[shot["Shot Type"]];
      shot.size = info ? info.size : 20; // Default size if not found
    });

    // Create a map for quick lookup
    var shotDataMap = new Map(
      shotTypeData.map((shot) => [shot["Shot Number"], shot])
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
      const shotInfo = shotDataMap.get(d["Shot Number"]);
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

    scriptData.forEach((event, i) => {
      const startTime = parseFloat(event["start_time"]);
      const endTime = parseFloat(event["end_time"]);
      const eventWidth = xScale(endTime - startTime);
      const xOffset = xScale(startTime);

      const defaultColor = "#9803fc"; // Default color
      const defaultHeight = 10; // Default height
      const yOffset = (svgHeight - defaultHeight) / 2; // Adjust position to not overlap with other visual elements

      // Append a rectangle for each event in the new dataset
      svg
        .append("rect")
        .attr("id", "script-bar-" + i)
        .attr("x", xOffset)
        .attr("y", yOffset)
        .attr("width", eventWidth)
        .attr("height", defaultHeight)
        .attr("fill", defaultColor)
        .attr("stroke", "black")
        .attr("opacity", 0.75) // Slightly transparent
        .attr("stroke-width", 1);
    });

    currentTimeLine = svg
      .append("line")
      .attr("id", "current-time-line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", svgHeight)
      .attr("stroke", "red") // Red line for visibility
      .attr("stroke-width", 2);

    drawMovements(svg, movements, xScale, svgHeight);
  });
}

function drawMovements(svg, movements, xScale, svgHeight) {
  // Loop through the movements data to draw lines
  movements.forEach(function (movement) {
    // Use the xScale to determine the start and end points on the x-axis
    var startX = xScale(movement.start_time);
    var endX = xScale(movement.end_time);

    // Set the stroke-dasharray based on whether the camera is moving or static
    var strokeDasharray = movement.Type === "stat" ? "0" : "5, 5"; // "5, 5" is a pattern of dashes

    // Draw the line on the SVG canvas
    svg
      .append("line")
      .attr("x1", startX)
      .attr("y1", svgHeight / 3.3) // Position the line in the middle of the SVG height
      .attr("x2", endX)
      .attr("y2", svgHeight / 3.3) // Keep the line horizontal
      .attr("stroke", movement.Type === "stat" ? "White" : "White") // Color the line differently if it's moving
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", strokeDasharray);
  });
}

//////////Camera Movement Visualization////////////////////////////////

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

d3.xml("./camera.svg").then((data) => {
  var externalSVG = data.documentElement; // Get the root element of the SVG file

  // Modify the SVG's width and height
  d3.select(externalSVG)
    .attr("width", rectState.width) // Set desired width
    .attr("height", rectState.height) // Set desired height
    .attr("x", rectState.x) // Initial X position, same as rectangle
    .attr("y", rectState.y); // Initial Y position, offset to be above the rectangle

  // Append the modified SVG to a <g> element within your main SVG
  var cameraGroup = svg3.append("g").attr("id", "camera");
  cameraGroup.node().appendChild(externalSVG.cloneNode(true));
});

var traceLayer = svg3.append("g").attr("id", "traceLayer");

svg3
  .append("rect")
  .attr("id", "rectangle")
  .attr("x", 130) // Starting x position
  .attr("y", 150) // Starting y position
  .attr("width", 40) // Width of the rectangle
  .attr("height", 40) // Height of the rectangle
  .attr("fill", "none"); // Fill color of the rectangle

var rectState = {
  // Initial state and current scene
  x: 130,
  y: 150,
  initialTranslateX: 0,
  initialTranslateY: 0,
  initialScaleX: 1,
  initialScaleY: 1,
  width: 40,
  height: 40,
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
  .attr("x", 10) // Initial X position, same as rectangle
  .attr("y", 290) // Initial Y position, offset to be above the rectangle
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

  var camera = d3.select("#camera");
  camera.attr("transform", "");
  // Optionally, update position if changed
  camera.attr("x", rectState.x).attr("y", rectState.y);
  d3.select("#movementText").text("Movement: None"); // Reset text

  traceLayer.selectAll("*").remove(); // This line clears the traceLayer
}

function recordAndDrawRectangle() {
  var rect = d3.select("#rectangle");
  var transform = rect.attr("transform");

  d3.xml("./camera_trace.svg").then((data) => {
    var externalSVG = data.documentElement; // Get the root element of the SVG file

    // Modify the SVG's width and height
    d3.select(externalSVG)
      .attr("x", rect.attr("x"))
      .attr("y", rect.attr("y"))
      .attr("width", rect.attr("width"))
      .attr("height", rect.attr("height"))
      // .style("fill", "red") // Set text color
      .style("stroke-width", "0pt")
      .attr("fill-opacity", 0.3);

    // Append the modified SVG to a <g> element within your main SVG
    cameraGroup = traceLayer
      .append("g")
      .attr("id", "cameraTrace")
      .attr("transform", transform);
    cameraGroup.node().appendChild(externalSVG.cloneNode(true));
  });
}

var recordInterval = setInterval(recordAndDrawRectangle, 1000);

function applyTransformation(movement, progress) {
  rectState.currentMovementType = movement.Type;

  var movementTypeText = "Movement: " + movement.Type;
  d3.select("#movementText").text(movementTypeText);

  var rect = d3.select("#rectangle");
  var camera = d3.select("#camera");

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

  rect.attr("transform", getTransformationString());
  camera.attr("transform", getTransformationString());
  // Update Y, considering offset
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
  var camera = d3.select("#camera");
  // Reset the rectangle to its initial attributes and transformation
  rect.attr("transform", "translate(130, 150)"); // Assuming these are the initial x and y positions
  camera.attr("transform", "translate(130, 150)"); // Assuming these are the initial x and y positions
  // You may also reset scale and rotation if they've been changed from the initial state
  // For example, if you initially had a scale or rotation applied:
  // rect.attr("transform", "translate(100, 50) scale(1) rotate(0)");
}
