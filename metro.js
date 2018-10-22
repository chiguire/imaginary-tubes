const stationNamesGrammar = {
	"origin": "#stationname.capitalize#",
  "stationname": ["#somethingford#", "#somethingbury#", "#somethingstone#", "#somethingham#", "#something#"],
  "somethingford": ["#something#ford"],
  "somethingbury": ["#something#bury"],
  "somethingstone": ["#something#stone"],
  "somethingham": ["#something#ham"],
  "something": ["leyton","ayles","crock","brad","mul","cad","ful","glad","bold","mert","am"],
};

const path = require('path'),
      atob = require('atob'),
      {fabric} = require('fabric'),
      fs = require('fs'),
      createTracery = function (randomCall) {
        var t = require('./tracery.js');
        t.randomCall = randomCall;
        return t;
      },
      MersenneTwister = require('mersenne-twister');

function gridDescription(originX, originY, 
                         tileWidth, tileHeight, 
                         canvasOriginX, canvasOriginY, 
                         canvasWidth, canvasHeight, 
                         cornerSize, cornerDetail,
                         stationsTraceryGrammar,
                         randomGenerator) {
  const gridDescBasic = {
    originX,
    originY,
    tileWidth,
    tileHeight,
    cornerSize,
    cornerDetail,
    nextStationName: function () { return stationsTraceryGrammar.flatten('#origin#'); },
    rnd: randomGenerator
  };
  const gridDescDims = {
    tl: gridPointFromWorldSpace(
        canvasOriginX, 
        canvasOriginY, 
        gridDescBasic, 
        Math.floor
      ),
    br: gridPointFromWorldSpace(
        canvasOriginX + canvasWidth, 
        canvasOriginY + canvasHeight, 
        gridDescBasic, 
        Math.ceil
      ),
  };
  // +x +y => 0..90
  // +x -y => 90..180
  // -x +y => -90..0
  // -x -y => -180..-90
  
  const uAngle = 0;
  const urAngle = Math.atan2(tileWidth, tileHeight);
  const rAngle = Math.PI / 2.0;
  const drAngle = Math.atan2(tileWidth, -tileHeight);
  const dAngle = Math.PI;
  const dlAngle = Math.atan2(-tileWidth, -tileHeight);
  const lAngle = -Math.PI / 2.0;
  const ulAngle = Math.atan2(-tileWidth, tileHeight);
  const gridDescAngles = {
    u:  [ulAngle / 2.0,                      urAngle / 2.0],
    ur: [urAngle / 2.0,                      urAngle + (rAngle - urAngle) / 2.0],
    r:  [urAngle + (rAngle - urAngle) / 2.0, rAngle + (drAngle - rAngle) / 2.0],
    dr: [rAngle + (drAngle - rAngle) / 2.0,  drAngle + (dAngle - drAngle) / 2.0],
    d:  [drAngle + (dAngle - drAngle) / 2.0, dlAngle + (-dAngle - dlAngle) / 2.0],
    dl: [drAngle + (dAngle - drAngle) / 2.0, lAngle + (dlAngle - lAngle) / 2.0],
    l:  [lAngle + (dlAngle - lAngle) / 2.0,  ulAngle + (lAngle - ulAngle) / 2.0],
    ul: [ulAngle + (lAngle - ulAngle) / 2.0, uAngle + (ulAngle - uAngle) / 2.0],
  }
  return Object.freeze(
    Object.assign(
      gridDescBasic,
      gridDescDims,
      {angles: gridDescAngles}
    )
  );
}

function toGridCoordX(worldX, gridDesc) {
  return (worldX - gridDesc.originX) / (gridDesc.tileWidth);
}

function toGridCoordY(worldY, gridDesc) {
  return (worldY - gridDesc.originY) / (gridDesc.tileHeight);
}

function toWorldCoordX(tileX, gridDesc) {
  return (tileX * gridDesc.tileWidth) + gridDesc.originX;
}

function toWorldCoordY(tileY, gridDesc) {
  return (tileY * gridDesc.tileHeight) + gridDesc.originY;
}

function allVertices(gridDesc) {
  const points = [];
  
  for (var tY = gridDesc.tl.tY; tY < gridDesc.br.tY; tY++) {
    for (var tX = gridDesc.tl.tX; tX < gridDesc.br.tX; tX++) {
      var p = gridPointFromGridSpace(tX,tY,gridDesc);
      points.push(p);
    }
  }
  
  return points;
}

function gridPointFromWorldSpace(x,y,gridDesc,roundFn) {
  const roundFnDefined = typeof roundFn === "function";
  const tX = (roundFnDefined?
    roundFn(toGridCoordX(x,gridDesc)):
    toGridCoordX(x,gridDesc)
  );
  const tY = (roundFnDefined?
    roundFn(toGridCoordY(y,gridDesc)):
    toGridCoordY(y,gridDesc)
  );
  return gridPointFromGridSpace(tX,tY,gridDesc);
}

function gridPointFromGridSpace(tX,tY,gridDesc) {
  return {
    x: toWorldCoordX(tX,gridDesc),
    y: toWorldCoordY(tY,gridDesc), 
    tX, 
    tY
  };
}

function edgeBetweenGridPoints(x0,y0,x1,y1,gridDesc) {
  return {
    a: gridPointFromGridSpace(x0,y0,gridDesc),
    b: gridPointFromGridSpace(x1,y1,gridDesc)
  };
}

function directionToXY(dir) {
  switch (dir) {
    case 'ul': return {x: -1, y: -1};
    case 'u' : return {x: 0,  y: -1};
    case 'ur': return {x: 1,  y: -1};
    case 'l' : return {x: -1, y: 0};
    case 'r' : return {x: 1,  y: 0};
    case 'dl': return {x: -1, y: 1};
    case 'd' : return {x: 0, y: 1};
    case 'dr': return {x: 1, y: 1};
    default: console.trace('unknown direction: '+dir); break;
  }
  return undefined;
}

function allEdges(gridDesc) {
  const edges = [];
  
  for (var tY = gridDesc.tl.tY; tY < gridDesc.br.tY; tY++) {
    for (var tX = gridDesc.tl.tX; tX < gridDesc.br.tX; tX++) {
      const evenX = tX % 2 === 0;
      const evenY = tY % 2 === 0;
      if (evenX === evenY) {
        edges.push(edgeBetweenGridPoints(tX,tY,tX+1,tY,gridDesc));
        edges.push(edgeBetweenGridPoints(tX,tY,tX+1,tY+1,gridDesc));
        edges.push(edgeBetweenGridPoints(tX,tY,tX,tY+1,gridDesc));
      } else {
        edges.push(edgeBetweenGridPoints(tX,tY,tX+1,tY,gridDesc));
        edges.push(edgeBetweenGridPoints(tX+1,tY,tX,tY+1,gridDesc));
        edges.push(edgeBetweenGridPoints(tX,tY,tX,tY+1,gridDesc));
      }
    }
  }
  return edges;
}

function directionsFromPoint(tX,tY,gridDesc) {
  const evenX = tX % 2 === 0;
  const evenY = tY % 2 === 0;
  const directionsToRemove = [].concat(
    (tX <= gridDesc.tl.tX? ['ul','l','dl']: []),
    (tY <= gridDesc.tl.tY? ['ul','u','ur']: []),
    (tX >= (gridDesc.br.tX)? ['ur','r','dr']: []),
    (tY >= (gridDesc.br.tY)? ['dl','d','dr']: [])
  );
  
  var directionsToAdd = undefined;
  if (evenX === evenY) { // all 8 directions
    directionsToAdd = ['ul','u','ur','l','r','dl','d','dr'];
  } else {               // just 4 directions
    directionsToAdd = ['u','l','r','d'];
  }
  
  return (directionsToRemove.length == 0?
    directionsToAdd:
    directionsToAdd.filter(function (d) {
      return !directionsToRemove.includes(d);
    })
  );
}

function edgesFromPoint(tX,tY,gridDesc) {
  const directions = directionsFromPOint(tX,tY,gridDesc);
  
  const edges = directions.map(function (d) {
    var dx = 0, dy =0;
    switch (d) {
      case 'ul': dx = -1; dy = -1; break;
      case 'u':  dx = 0;  dy = -1; break;
      case 'ur': dx = 1;  dy = -1; break;
      case 'l':  dx = -1; dy = 0;  break;
      case 'r':  dx = 1;  dy = 0;  break;
      case 'dl': dx = -1; dy = 1;  break;
      case 'd':  dx = 0;  dy = 1;  break;
      case 'dr': dx = 1;  dy = 1;  break;
      default: console.log('unknown direction ' + d);
    }
    return edgeBetweenGridPoints(tX, tY, tX+dx, tY+dy, gridDesc);
  });
  
  return edges;
}

function drawTetrakisGrid(c, gridDesc) {
  const points = allVertices(gridDesc);
  const edges = allEdges(gridDesc);
  edges.forEach(function (edge) {
    var e = new fabric.Line([edge.a.x,edge.a.y,edge.b.x,edge.b.y], {
      stroke: 'rgba(3,3,3,0.33)',
      strokeWidth: 0.5
    });
    c.add(e);
  });
  
  points.forEach(function (point) {
    var p = new fabric.Circle({
      left: point.x,
      top: point.y,
      radius: 1,
      fill: "rgba(0,0,0,0.33)"
    });
    c.add(p);
  });
}

function edgeExtremes() {
  return ['lr','ud'];
}

function choose(arr, rndGen) {
  if (arr.length === 0) {
    return null;
  }
  return arr[Math.floor(rndGen.random() * arr.length)];
}

function vertexInsideGrid(tX, tY, gridDesc) {
  return gridDesc.tl.tX <= tX &&
         tX <= gridDesc.br.tX &&
         gridDesc.tl.tY <= tY &&
         tY <= gridDesc.br.tY;
}

function chooseDirection(diffX, diffY, absDiffX, absDiffY, pX, pY, generalDirection, gridDesc) {
  const possibleDirectionsFromPoint = directionsFromPoint(pX, pY, gridDesc);
  var dX = null;
  var dY = null;
  
  var angle = Math.atan2(diffX, diffY) + Math.PI*2;
  var angles = gridDesc.angles;
  // +x +y => 0..90
  // +x -y => 90..180
  // -x +y => -90..0
  // -x -y => -180..-90
  
  if (angles.u[0] + Math.PI*2 < angle && angle < angles.u[1] + Math.PI*2) {
    var idealDirection = 'd';
  } else if (angles.ur[0] + Math.PI*2 <= angle && angle <= angles.ur[1] + Math.PI*2) {
    var idealDirection = 'dr';
  } else if (angles.r[0] + Math.PI*2 < angle && angle < angles.r[1] + Math.PI*2) {
    var idealDirection = 'r';
  } else if (angles.dr[0] + Math.PI*2 <= angle && angle <= angles.dr[1] + Math.PI*2) {
    var idealDirection = 'ur';
  } else if (angles.d[0] + Math.PI*2 < angle && angle < angles.d[1] + Math.PI*2) {
    var idealDirection = 'u';
  } else if (angles.dl[0] + Math.PI*2 <= angle && angle <= angles.dl[1] + Math.PI*2) {
    var idealDirection = 'ul';
  } else if (angles.l[0] + Math.PI*2 < angle && angle < angles.l[1] + Math.PI*2) {
    var idealDirection = 'l';
  } else if (angles.ul[0] + Math.PI*2 <= angle && angle <= angles.ul[1] + Math.PI*2) {
    var idealDirection = 'dl';
  } else {
    console.trace("What direction to pick here? " + angle);
  }
  
  if (possibleDirectionsFromPoint.includes(idealDirection)) {
    return idealDirection;
  } else { // Project ideal Direction over possibilities
    var projectedDirection = possibleDirectionsFromPoint.find(d => idealDirection.indexOf(d) !== -1);
    if (typeof projectedDirection === "undefined") {
      console.trace("Projected direction is undefined. Diff: (" + diffX + "," + diffY + ") Angle: " + (angle/Math.PI*180) + " Ideal Direction: " + idealDirection + ", Possible: " + JSON.stringify(possibleDirectionsFromPoint) + ", Point: " + pX + ", " + pY);
    }
    return projectedDirection;
  }
}

function flatten(items) {
  const flat = [];
  items.forEach(item => {
    if (Array.isArray(item)) {
      flat.push(...flatten(item));
    } else {
      flat.push(item);
    }
  });
  return flat;
}

function dotProduct(vo0, vo1) {
  return vo0.x*vo1.x + vo0.y*vo1.y;
}

function magnitude(v) {
  return Math.sqrt(v.x*v.x + v.y*v.y);
}

function angleBetweenTwoVectors(v0, v1) {
  const vo0 = {
    x: v0.b.x - v0.a.x,
    y: v0.b.y - v0.a.y,
  };
  const vo1 = {
    x: v1.b.x - v1.a.x,
    y: v1.b.y - v1.a.y,
  };
  const dot = dotProduct(vo0, vo1);
  const mv0 = magnitude(vo0);
  const mv1 = magnitude(vo1);
  
  return Math.acos(dot/(mv0*mv1));
}

function lerp(p1, p2, time) {
  return {
    x: p1.x + (p2.x - p1.x) * time,
    y: p1.y + (p2.y - p1.y) * time,
  };
}

function deCasteljau(start, control1, control2, end, time) {
  //Outside Guide Lines
  const outerA      = [start,    control1];
  const outerBridge = [control1, control2];
  const outerB      = [control2, end];
  
  //Inner Guide Lines
  const innerA      = [lerp(outerA[0], outerA[1], time),           lerp(outerBridge[0], outerBridge[1], time)];
  const innerB      = [lerp(outerBridge[0], outerBridge[1], time), lerp(outerB[0], outerB[1], time)];
  const innerBridge = [lerp(innerA[0], innerB[1], time),           lerp(innerB[0], innerB[1], time)];
 
  //Point at time
  return lerp(innerBridge[0], innerBridge[1], time);
}

function recursiveLineBreak(lines, maxLevel, gridDesc) {
  return flatten(lines.map(function (line) {
    const midPoint = {
      x: Math.round(line.x0 + (line.x1-line.x0)/2),
      y: Math.round(line.y0 + (line.y1-line.y0)/2),
    };
    // TODO generate points around midpoint, choose one to introduce a bit of noise
    //const diff = generateDifferences(x, y, 5, 5, gridDesc);
    //const selectedDiff = diff[gridDesc.rnd.
    return [
      {
        x0: line.x0,
        y0: line.y0,
        x1: midPoint.x,
        y1: midPoint.y,
      },
      {
        x0: midPoint.x,
        y0: midPoint.y,
        x1: line.x1,
        y1: line.y1,
      },
    ];
  }));
}

function rasterizeLines(lines, extremes, gridDesc) {
  var rasterizedLines = lines.map(function (line) {
    var pX = line.x0;
    var pY = line.y0;
    var diffX = line.x1 - pX;
    var diffY = line.y1 - pY;
    var absDiffX = Math.abs(diffX);
    var absDiffY = Math.abs(diffY);
    var segments = [];
    var vertices = [gridPointFromGridSpace(pX, pY, gridDesc)];
    
    //console.log("Rasterizing");
    //console.log(line);
    while (absDiffX + absDiffY !== 0) {
      const direction = chooseDirection(diffX, diffY, absDiffX, absDiffY, pX, pY, extremes, gridDesc);
      const directionXY = directionToXY(direction);
      const dX = directionXY.x;
      const dY = directionXY.y;
      //console.log({diffX,diffY,absDiffX,absDiffY,pX,pY,extremes,direction,dX,dY});
      const nX = pX + dX;
      const nY = pY + dY;
      segments.push(edgeBetweenGridPoints(pX, pY, nX, nY, gridDesc));
      vertices.push(gridPointFromGridSpace(nX, nY, gridDesc));
      pX = nX;
      pY = nY;
      diffX = line.x1 - pX;
      diffY = line.y1 - pY;
      absDiffX = Math.abs(diffX);
      absDiffY = Math.abs(diffY);
    }
    
    return { segments, vertices };
  });
  
  return {
    segments: flatten(rasterizedLines.map(l => l.segments)),
    vertices: flatten(rasterizedLines.map(l => l.vertices)),
  };
}

function generateSegments(extremes, gridDesc) {
  var rnd = gridDesc.rnd;
  switch (extremes) {
    case 'lr':
      var x0 = 0;
      var y0 = Math.floor(gridDesc.tl.tY+1+rnd.random()*(gridDesc.br.tY - gridDesc.tl.tY - 2));
      var x1 = gridDesc.br.tX;
      var y1 = Math.floor(gridDesc.tl.tY+1+rnd.random()*(gridDesc.br.tY - gridDesc.tl.tY - 2));
      break;
    case 'ud':
      var x0 = Math.floor(gridDesc.tl.tX+1+rnd.random()*(gridDesc.br.tX - gridDesc.tl.tX - 2));
      var y0 = 0;
      var x1 = Math.floor(gridDesc.tl.tX+1+rnd.random()*(gridDesc.br.tX - gridDesc.tl.tX - 2));
      var y1 = gridDesc.br.tY;
      break;
    default:
      console.log('UNKNOWN EXTREMES ' + extremes);
      break;
  }
  
  //console.log("Chosen extremes");
  //console.log({extremes,x0,y0,x1,y1});
  const brokenLines = recursiveLineBreak([{x0,y0,x1,y1}],1,gridDesc);
  //console.log("Broken lines");
  //console.log({brokenLines});
  const rasterizedLines = rasterizeLines(brokenLines, extremes, gridDesc);
  //console.log("Rasterized lines");
  //console.log(rasterizedLines);
  const halvedLines = halveLines(rasterizedLines.segments);
  var smoothedLines = [];
  for (var i = 0; i < halvedLines.length - 1; i++) {
    const smoothedSegment = smoothLines(halvedLines[i], halvedLines[i+1], gridDesc.cornerSize, gridDesc.cornerDetail);
    smoothedLines.push(...smoothedSegment);
    if (smoothedSegment.length !== 1) {
      i++; // If smoothLines() has created a curved line, we have consumed both lines
    }
  }
  smoothedLines.push(halvedLines[halvedLines.length - 1]); // Push the last one
  //console.log("Smoothed lines");
  //console.log(smoothedLines);
  return { segments: smoothedLines, vertices: rasterizedLines.vertices };
}

function halveLines(lines) {
  return flatten(lines.map(function (line) {
    const midpoint = lerp(line.a, line.b, 0.5);
    return [
      {
        a: line.a,
        b: midpoint,
      },
      {
        a: midpoint,
        b: line.b,
      }
    ];
  }));
}

function smoothLines(line1,line2, cornerSize, cornerDetail) { //line2 begins where line1 ends
  if (angleBetweenTwoVectors(line1,line2) < Number.EPSILON) {
    return [line1]; // same line, no need to smooth anything
  } else { // returns list of lines that form a curve
    const line1Length = Math.sqrt(Math.pow(line1.b.x - line1.a.x, 2) + Math.pow(line1.b.y - line1.a.y, 2));
    const line2Length = Math.sqrt(Math.pow(line2.b.x - line2.a.x, 2) + Math.pow(line2.b.y - line2.a.y, 2));
    const start = {
      x: line1.a.x + (1 - cornerSize/line1Length) * (line1.b.x - line1.a.x),
      y: line1.a.y + (1 - cornerSize/line1Length) * (line1.b.y - line1.a.y)
    };
    const control1 = {
      x: line2.a.x,
      y: line2.a.y
    };
    const end = {
      x: line2.a.x + (cornerSize/line2Length) * (line2.b.x - line2.a.x),
      y: line2.a.y + (cornerSize/line2Length) * (line2.b.y - line2.a.y)
    }
    var points = [];
    for (var i = 0; i != cornerDetail + 1; i++) {
      points.push(deCasteljau(start, control1, control1, end, i/cornerDetail));
    }
    var lines = [{
      a: line1.a,
      b: start
    }];
    for (var i = 0; i < points.length - 1; i++) {
      lines.push({
        a: points[i],
        b: points[i+1]
      });
    }
    lines.push({
      a: end,
      b: line2.b
    });
    return lines;
  }
}

function generatePotentialStations(vertices, gridDesc) {
  // Scan vertices array from the beginning, put a station each X distance
  // They're potential Stations because later in the process they could merge with interchanges
  const lineLength = vertices.length;
  const numberOfStations = Math.floor(lineLength/2.0); // TODO set as random
  const distancePerStation = lineLength / numberOfStations;
  var distanceCovered = 0;
  var currentVertexIndex = 0;
  var indices = Array.apply(null, {length:vertices.length}).map(Number.call, Number);
  var potentialStations = indices.map((i) => {
    return {
      name: gridDesc.nextStationName(),
      position: vertices[i],
      line: [vertices[i], {
        x: vertices[i].x+20,
        y: vertices[i].y+20
      }], // A line that represents the station, London tube style, requires calculating vector direction
    };
  });
  return potentialStations;
}

function tubeLine(name, color, otherLines, gridDesc) {
  const extremes = choose(edgeExtremes(), gridDesc.rnd);
  const { segments, vertices } = generateSegments(extremes, gridDesc);
  const potentialStations = generatePotentialStations(vertices, gridDesc);
  return {
    name,
    color,
    extremes,
    segments,
    potentialStations,
  };
}

function tubeLines(gridDesc) {
  return [
    tubeLine('Central', 'rgb(255,0,0)', [], gridDesc),
    tubeLine('Picadilly', 'rgb(0,0,127)', [], gridDesc),
    tubeLine('Jubilee', 'rgb(110,110,110)', [], gridDesc),
    tubeLine('Bakerloo', 'rgb(160,100,0)', [], gridDesc),
  ];
}

function drawLines(c, lines) {
  
  lines.forEach(function (line) {
    const points = line.segments.map((segment) => ({ x: segment.a.x, y: segment.a.y })).concat([{ x: line.segments[line.segments.length-1].b.x, y: line.segments[line.segments.length-1].b.y }]);
    var e = new fabric.Polyline(
      points,
      {
        stroke: line.color,
        strokeWidth: 5,
        fill: 'transparent',
      }
    );
    c.add(e);
    
    //console.trace(line);
    const stations = line.potentialStations.map((station) => {
      var l = new fabric.Line([station.line[0].x, station.line[0].y, station.line[1].x, station.line[1].y], {
        stroke: line.color,
        strokeWidth: 5
      });
      c.add(l);
      
      var t = new fabric.Text(station.name, {
        left: station.position.x,
        top: station.position.y,
        fill: '#333333',
        fontSize: 12,
        fontWeight: 'normal',
        fontFamily: 'Arial',
        originY: 'bottom'
      });
      c.add(t);
    });
  });
}

function choumein() {
  const canvas = new fabric.Canvas(
    null, 
    {
      width:1024,
      height:512,
      backgroundColor: '#ffffff'
    }
  );
  const seed = Date.now().valueOf();
  const rnd = new MersenneTwister(seed);
  //fabric.Object.prototype.originX = fabric.Object.prototype.originY = 'center';
  
  const tracery = createTracery(function() { return rnd.random(); });
  var grammar = tracery.createGrammar(stationNamesGrammar);
  grammar.addModifiers(tracery.baseEngModifiers);
  const gridDesc = gridDescription(30, 10, 80, 80, 0, 0, canvas.width-20-80, canvas.height-20-80, 20, 5, grammar, rnd);
  console.log("Grid description");
  console.log(gridDesc);
  const lines = tubeLines(gridDesc);
  
  drawTetrakisGrid(canvas, gridDesc);
  drawLines(canvas, lines);
  
  const pngImageB64 = canvas.toDataURL({ format: 'png' });
  const pngImage = atob(pngImageB64.split(',')[1]);
  fs.writeFileSync('metro-' + seed + '.png',pngImage,{encoding:'binary'});
}

choumein();
exports = {
  gridDescription,
  tubeLines,
  drawLines
};