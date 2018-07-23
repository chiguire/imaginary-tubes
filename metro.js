const path = require('path'),
      atob = require('atob'),
      {fabric} = require('fabric'),
      fs = require('fs'),
      MersenneTwister = require('mersenne-twister');

function gridDescription(originX, originY, 
                         tileWidth, tileHeight, 
                         canvasOriginX, canvasOriginY, 
                         canvasWidth, canvasHeight, 
                         randomGenerator) {
  const gridDescBasic = {
    originX,
    originY,
    tileWidth,
    tileHeight,
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
  return Object.freeze(
    Object.assign(
      gridDescBasic,
      gridDescDims
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
    (tX >= (gridDesc.br.tX-1)? ['ur','r','dr']: []),
    (tY >= (gridDesc.br.tY-1)? ['dl','d','dr']: [])
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
  // const newEdges = [].concat(
    // edgesFromPoint(gridDesc.tl.tX, gridDesc.tl.tY, gridDesc),
    // edgesFromPoint(gridDesc.tl.tX, gridDesc.br.tY, gridDesc),
    // edgesFromPoint(gridDesc.br.tX, gridDesc.tl.tY, gridDesc),
    // edgesFromPoint(gridDesc.br.tX, gridDesc.br.tY, gridDesc),
    // edgesFromPoint(2, 2, gridDesc),
    // edgesFromPoint(3, 4, gridDesc)
  // );
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
  
  // newEdges.forEach(function (edge) {
    // var e = new fabric.Line([edge.a.x,edge.a.y,edge.b.x,edge.b.y], {
      // stroke: 'rgba(255,0,0,1)',
      // strokeWidth: 1
    // });
    // c.add(e);
  // });
}

function edgeExtremes() {
  return ['lr','rl','ud','du'];
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

function chooseDirection(dX, dY, pX, pY, extremes, gridDesc) {
  const possibleDirectionsFromPoint = directionsFromPoint(pX, pY, gridDesc);
  
  if (dX < 0) {
    if (dY < 0) {        // ul
      var preferredDirections = ['ul','u','l'];
    } else if (dY > 0) { // dl
      var preferredDirections = ['dl','d','l'];
    } else {             // l
      var preferredDirections = ['ul','l','dl'];
    }
  } else if (dX > 0) {
    if (dY < 0) {        // ur
      var preferredDirections = ['ur','u','r'];
    } else if (dY > 0) { // dr
      var preferredDirections = ['dr','d','r'];
    } else {             // d
      var preferredDirections = ['dr','d','dl'];
    }
  } else {
    if (dY < 0) {        // u
      var preferredDirections = ['ul','u','ur'];
    } else if (dY > 0) { // d
      var preferredDirections = ['dl','d','dr'];
    } else {             // no direction, weird
      console.log("no direction, weird");
    }
  }
  
  const dirs = preferredDirections.filter(function (d) {
    return possibleDirectionsFromPoint.includes(d);
  });
  
  return directionToXY(choose(dirs, gridDesc.rnd));
}

function generateSegments(extremes, gridDesc) {
  var rnd = gridDesc.rnd;
  switch (extremes) {
    case 'lr':
      var pX = 0;
      var pY = Math.floor(gridDesc.tl.tY+rnd.random()*(gridDesc.br.tY - gridDesc.tl.tY));
      var dX = 1;
      var dY = Math.round((rnd.random()-0.5)*2); // bias towards not moving
      break;
    case 'rl':
      var pX = gridDesc.br.tX;
      var pY = Math.floor(gridDesc.tl.tY+rnd.random()*(gridDesc.br.tY - gridDesc.tl.tY));
      var dX = -1;
      var dY = Math.round((rnd.random()-0.5)*2); // bias towards not moving
      break;
    case 'ud':
      var pX = Math.floor(gridDesc.tl.tX+rnd.random()*(gridDesc.br.tX - gridDesc.tl.tX));
      var pY = 0;
      var dX = Math.round((rnd.random()-0.5)*2); // bias towards not moving
      var dY = 1;
      break;
    case 'du':
      var pX = Math.floor(gridDesc.tl.tX+rnd.random()*(gridDesc.br.tX - gridDesc.tl.tX));
      var pY = gridDesc.br.tY;
      var dX = Math.round((rnd.random()-0.5)*2); // bias towards not moving
      var dY = -1;
      break;
    default:
      console.log('UNKNOWN EXTREMES ' + extremes);
      break;
  }
  
  var segments = [];
  var vertices = [{x: pX, y: pY}];
  const givenSegmentDistance = 5;
  var currentSegmentDistance = givenSegmentDistance;
  while (vertexInsideGrid(pX+dX, pY+dY, gridDesc)) {
    const newVertex = {x: pX+dX, y: pY+dY};
    const newEdge = edgeBetweenGridPoints(pX, pY, newVertex.x, newVertex.y, gridDesc);
    segments.push(newEdge);
    vertices.push(newVertex);
    
    pX += dX;
    pY += dY;
    currentSegmentDistance -= 1;
    if (currentSegmentDistance === 0) {
      var newDirection = chooseDirection(dX, dY, pX, pY, extremes, gridDesc);
      dX = newDirection.x;
      dY = newDirection.y;
      currentSegmentDistance = givenSegmentDistance;
    }
  }
  return { segments, vertices };
}

function tubeLine(name, color, otherLines, gridDesc) {
  const extremes = choose(edgeExtremes(), gridDesc.rnd);
  const { segments, vertices } = generateSegments(extremes, gridDesc);
  return {
    name,
    color,
    extremes,
    segments, //layoutSegments
  };
}

function tubeLines(gridDesc) {
  return [
    tubeLine('Central', 'rgb(255,0,0)', [], gridDesc),
  ];
}

function drawLines(c, lines) {
  lines.forEach(function (line) {
    line.segments.forEach(function (edge) {
      var e = new fabric.Line([edge.a.x,edge.a.y,edge.b.x,edge.b.y], {
        stroke: 'rgba(255,0,0,1)',
        strokeWidth: 1
      });
      c.add(e);
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
  const rnd = new MersenneTwister(Date.now().valueOf());
  fabric.Object.prototype.originX = fabric.Object.prototype.originY = 'center';
  
  const gridDesc = gridDescription(0, 0, 20, 10, 0, 0, canvas.width-20, canvas.height-10, rnd);
  //console.log(gridDesc);
  const lines = tubeLines(gridDesc);
  
  drawTetrakisGrid(canvas, gridDesc);
  drawLines(canvas, lines);
  
  const pngImageB64 = canvas.toDataURL({ format: 'png' });
  const pngImage = atob(pngImageB64.split(',')[1]);
  fs.writeFileSync('metro-' + (Date.now().valueOf()) + '.png',pngImage,{encoding:'binary'});
}

choumein();
exports = {
  gridDescription,
  tubeLines,
  drawLines
};