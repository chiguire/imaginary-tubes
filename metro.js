const path = require('path'),
      atob = require('atob'),
      {fabric} = require('fabric'),
      fs = require('fs');

function gridDescription(originX, originY, tileWidth, tileHeight, canvasOriginX, canvasOriginY, canvasWidth, canvasHeight) {
  const gridDescBasic = {
    originX,
    originY,
    tileWidth,
    tileHeight,
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
  
  for (var tY = gridDesc.tl.tY+1; tY < gridDesc.br.tY; tY++) {
    for (var tX = gridDesc.tl.tX+1; tX < gridDesc.br.tX; tX++) {
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

function allEdges(gridDesc) {
  const edges = [];
  
  for (var tY = gridDesc.tl.tY+1; tY < gridDesc.br.tY; tY++) {
    for (var tX = gridDesc.tl.tX+1; tX < gridDesc.br.tX; tX++) {
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

function edgesFromPoint(tX,tY,gridDesc) {
  const evenX = tX % 2 === 0;
  const evenY = tY % 2 === 0;
  const directionsToRemove = [].concat(
    (tX <= gridDesc.tl.tX? ['ul','l','dl']: []),
    (tY <= gridDesc.tl.tY? ['ul','u','ur']: []),
    (tX >= gridDesc.br.tX? ['ur','r','dr']: []),
    (tY >= gridDesc.br.tY? ['dl','d','dr']: [])
  );
  
  var directionsToAdd = undefined;
  if (evenX === evenY) { // all 8 directions
    directionsToAdd = ['ul','u','ur','l','r','dl','d','dr'];
  } else {               // just 4 directions
    directionsToAdd = ['u','l','r','d'];
  }
  
  const directions = (directionsToRemove.length == 0?
    directionsToAdd:
    directionsToAdd.filter(function (d) {
      return !directionsToRemove.includes(d);
    })
  );
  
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
  const newEdges = [].concat(
    edgesFromPoint(gridDesc.tl.tX, gridDesc.tl.tY, gridDesc),
    edgesFromPoint(gridDesc.tl.tX, gridDesc.br.tY, gridDesc),
    edgesFromPoint(gridDesc.br.tX, gridDesc.tl.tY, gridDesc),
    edgesFromPoint(gridDesc.br.tX, gridDesc.br.tY, gridDesc),
    edgesFromPoint(2, 2, gridDesc),
    edgesFromPoint(3, 4, gridDesc)
  );
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
  
  newEdges.forEach(function (edge) {
    var e = new fabric.Line([edge.a.x,edge.a.y,edge.b.x,edge.b.y], {
      stroke: 'rgba(255,0,0,1)',
      strokeWidth: 1
    });
    c.add(e);
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
  fabric.Object.prototype.originX = fabric.Object.prototype.originY = 'center';
  
  const gridDesc = gridDescription(0, 0, 20, 10, 0, 0, canvas.width-20, canvas.height-10);
  //console.log(gridDesc);
  drawTetrakisGrid(canvas, gridDesc);
  
  const pngImageB64 = canvas.toDataURL({ format: 'png' });
  const pngImage = atob(pngImageB64.split(',')[1]);
  fs.writeFileSync('metro-' + (Date.now().valueOf()) + '.png',pngImage,{encoding:'binary'});
}

choumein();