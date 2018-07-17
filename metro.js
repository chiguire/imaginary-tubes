const path = require('path'),
      atob = require('atob'),
      {fabric} = require('fabric'),
      fs = require('fs');

function gridDescription(originX, originY, tileWidth, tileHeight) {
  return {
    originX: originX,
    originY: originY,
    tileWidth: tileWidth,
    tileHeight: tileHeight,
  };
}

function toGridCoordX(worldX, gridDesc) {
  return (worldX-gridDesc.originX)/(gridDesc.tileWidth);
}

function toGridCoordY(worldY, gridDesc) {
  return (worldY-gridDesc.originY)/(gridDesc.tileHeight);
}

function toWorldCoordX(tileX, gridDesc) {
  return (tileX*gridDesc.tileWidth) + gridDesc.originX;
}

function toWorldCoordY(tileY, gridDesc) {
  return (tileY*gridDesc.tileHeight) + gridDesc.originY;
}

function allVertices(left,top,right,bottom,gridDesc) {
  const tl = gridPointFromWorldSpace(left, top, gridDesc, Math.floor);
  const br = gridPointFromWorldSpace(bottom, right, gridDesc, Math.ceil);
  const points = [];
  
  for (var tY = tl.tY+1; tY < br.tY; tY++) {
    for (var tX = tl.tX+1; tX < br.tX; tX++) {
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

function allEdges(left,top,right,bottom,gridDesc) {
  const tl = gridPointFromWorldSpace(left, top, gridDesc, Math.floor);
  const br = gridPointFromWorldSpace(bottom, right, gridDesc, Math.ceil);
  const edges = [];
  
  for (var tY = tl.tY+1; tY < br.tY; tY++) {
    for (var tX = tl.tX+1; tX < br.tX; tX++) {
      var evenX = tX % 2 === 0;
      var evenY = tY % 2 === 0;
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

function drawTetrakisGrid(c, gridDesc) {
  var points = allVertices(0,0,c.width, c.height, gridDesc);
  var edges = allEdges(0,0,c.width,c.height,gridDesc);
  
  edges.forEach(function (edge) {
    var e = new fabric.Line([edge.a.x,edge.a.y,edge.b.x,edge.b.y], {
      fill: 'red',
      stroke: 'red',
      strokeWidth: 0.5
    });
    c.add(e);
  });
  
  points.forEach(function (point) {
    var p = new fabric.Circle({
      left: point.x,
      top: point.y,
      radius: 1,
      fill: "rgb(0,0,0)"
    });
    c.add(p);
  });
  
}

function choumein() {
  var canvas = new fabric.Canvas(
    null, 
    {
      width:1024,
      height:512,
      backgroundColor: '#ffffff'
    }
  );
  fabric.Object.prototype.originX = fabric.Object.prototype.originY = 'center';
  
  const gridDesc = gridDescription(0, 0, 20, 10);
  drawTetrakisGrid(canvas, gridDesc);
  
  var pngImageB64 = canvas.toDataURL({ format: 'png' });
  var pngImage = atob(pngImageB64.split(',')[1]);
  fs.writeFileSync('metro-' + (Date.now().valueOf()) + '.png',pngImage,{encoding:'binary'});
}

choumein();