const showIntermediatePoints = true;

const parkingLotRTree = new rbush();
const superMarketRTree = new rbush();
const sectionText = document.getElementById("SECTIONID");
const parkingText = document.getElementById("INFOPARKING");
const backButton = document.getElementById("back-id");
const forwardButton = document.getElementById("forward-id");
const factory = new jsts.geom.GeometryFactory();

var aSortedDinstanceParkingLotSuperMarket;

const INITIAL_VIEW_STATE = {
  longitude: 13.302428631992042,
  latitude: 52.50131842240836,
  zoom: 15
}

// Add Mapbox GL for the basemap. It's not a requirement if you don't need a basemap.
const map = new mapboxgl.Map({
  container: 'map',
  interactive: false,
  style: carto.basemaps.voyager,
  center: [INITIAL_VIEW_STATE.longitude, INITIAL_VIEW_STATE.latitude],
  zoom: INITIAL_VIEW_STATE.zoom
});
const listInfo = ["name", "opening_hours", "website", "addr:street"];
const getParkingSpaceInfo = evt => {
  let parkingSpotInfos = evt.object.properties;
  let coord = evt.object.geometry.coordinates[0].map(e => new jsts.geom.Coordinate(e[0], e[1]));
  //console.log(coord);
  let areaParkingSpot = factory.createPolygon(coord).getArea();
  if (parkingSpotInfos) {
    let txt = "";
    Object.entries(parkingSpotInfos).forEach(([key, value]) => {
      if (listInfo.includes(key)) {
        if (key==="name") {
          key= "Kette";
        }
        if (key==="opening_hours") {
          key= "Öffnungszeiten";
        }
        if (key==="addr:street") {
          key= "Straße";
        }
        txt += `<li>${key}: ${value}</li>`
      }
    })
    parkingText.innerHTML = JSON.stringify(parkingSpotInfos, undefined, 2);

    let areaqm = areaParkingSpot * 1000000000;
    parkingText.innerHTML = `<ul>${txt}</ul>` + `Größe Parkplatz: ${areaqm.toFixed()} m²`;
  }
}
const parkingLotLayer = new deck.GeoJsonLayer({
  id: 'parking-lot-layer',
  pickable: true,
  stroked: false,
  filled: true,
  extruded: true,
  lineWidthScale: 20,
  lineWidthMinPixels: 2,
  getFillColor: [160, 160, 180, 200],
  getLineColor: _ => [160, 160, 180, 200],
  getRadius: 5,
  getLineWidth: 1,
  getElevation: 2,
  onClick: evt => getParkingSpaceInfo(evt)
});

const superMarketLayer = new deck.GeoJsonLayer({
  id: 'super-market-layer',
  pickable: true,
  stroked: false,
  filled: true,
  extruded: true,
  lineWidthScale: 20,
  lineWidthMinPixels: 2,
  getFillColor: [180, 30, 30, 200],
  getLineColor: _ => [160, 160, 180, 200],
  getRadius: 5,
  getLineWidth: 1,
  getElevation: 20
});

const ICON_MAPPING = {
  marker: {
    x: 0,
    y: 0,
    width: 128,
    height: 128,
    mask: true,
    anchorX: -64,
    anchorY: -64
  }
};
const getMapIcon = () => {
  return 'marker';
}

const getCoordinates = d => {
  return d.coordinates;
}

let bottomLeft = [13.3, 52.5];
let topRight = [13.35, 52.55];

let displayLoaderCounter = 0;

function showLoader() {
  displayLoaderCounter++;
  if (displayLoaderCounter > 0) {
    document.getElementById("loader").style.display = "initial";
  }
}

function hideLoader() {
  displayLoaderCounter--;
  if (displayLoaderCounter <= 0) {
    document.getElementById("loader").style.display = "none";
  }
}

function loadParkingLots() {
  let query = `data=[out:json][timeout:50];
  (
  ++nwr["amenity"="parking"](`+ bottomLeft[1] + `,` + bottomLeft[0] + `,` + topRight[1] + `,` + topRight[0] + `);
  );
  out+body;
  >;
  out+skel+qt;`
  return loadLayerWithOverpass(parkingLotLayer, encodeURI(query), parkingLotRTree);
}
function loadSuperMarkets() {
  let query = `data=[out:json][timeout:50];
  (
  ++nwr["shop"="supermarket"](`+ bottomLeft[1] + `,` + bottomLeft[0] + `,` + topRight[1] + `,` + topRight[0] + `);
  );
  out+body;
  >;
  out+skel+qt;`
  return loadLayerWithOverpass(superMarketLayer, encodeURI(query), superMarketRTree);
}

function loadLayerWithOverpass(oLayer, oQuery, oRIndex) {
  showLoader();
  return fetch("https://lz4.overpass-api.de/api/interpreter", {
    "body": oQuery,
    "method": "POST"
  }).then(res => res.json()).then(oResult => {
    let oFeatureCollection = osmtogeojson(oResult);

    for (let oFeature of oFeatureCollection.features) {
      if (oFeature.geometry.type == "Point") {
        oRIndex.insert({
          "minX": oFeature.geometry.coordinates[0],
          "minY": oFeature.geometry.coordinates[1],
          "maxX": oFeature.geometry.coordinates[0],
          "maxY": oFeature.geometry.coordinates[1],
          "feature": oFeature
        });
      } else if(oFeature.geometry.type == "Polygon") {
        let coord = oFeature.geometry.coordinates[0].map(e => new jsts.geom.Coordinate(e[0], e[1]));
        let oPolygon = factory.createPolygon(coord);
        let oCenter = oPolygon.getCentroid().getCoordinate();
        oRIndex.insert({
          "minX": oCenter.x,
          "minY": oCenter.y,
          "maxX": oCenter.x,
          "maxY": oCenter.y,
          "feature": {"geometry": {"coordinates": [oCenter.x, oCenter.y]}}
        });
      }
    }

    oLayer.updateState(
      {
        props: {
          data: oFeatureCollection,
        },
        changeFlags: { dataChanged: true }
      }
    );
    hideLoader();
  }).catch(e => {
    console.error(e);
  });
}
let intermediateOptimizationPoints = [];

function optimizeLocation(start, rTrees) {
  const scorePoint = tf.tensor1d([start[0], start[1]]).variable();
  intermediateOptimizationPoints = [];
  // finds the closest parking lot
  // calculate distance
  // TODO:
  // use cumulative normal distribution function for judging distance
  // - very close -> very good
  // - far away -> we don't care
  const scoreOfCurrentCoordinates = _ => {
    let pointCoordinates = [scorePoint.dataSync()[0], scorePoint.dataSync()[1]];
    intermediateOptimizationPoints.push(pointCoordinates);
    // console.log(pointCoordinates);
    let closestFeatures = rTrees.map(rTree => knn(rTree, pointCoordinates[0], pointCoordinates[1], 1));
    // console.log(closestFeature);
    // distance to start point
    let closestFeature = closestFeatures.pop();
    let squaredDifference = tf.squaredDifference(scorePoint, tf.tensor1d(closestFeature[0].feature.geometry.coordinates)).sum().sqrt();
    for(closestFeature of closestFeatures) {
      squaredDifference.add(tf.squaredDifference(scorePoint, tf.tensor1d(closestFeature[0].feature.geometry.coordinates)).sum().sqrt());
    }
    // console.log(squaredDifference.dataSync()[0]);
    return squaredDifference;
  };

  const learningRate = 0.00005;
  const optimizer = tf.train.sgd(learningRate);
  for (let i = 0; i < 100; i++) {
    optimizer.minimize(scoreOfCurrentCoordinates);
  }
  let intermediateLocationLayer;
  if (showIntermediatePoints) {
    intermediateLocationLayer = new deck.IconLayer({
      id: 'intermediate-location-layer',
      pickable: true,
      // iconAtlas and iconMapping are required
      // getIcon: return a string
      iconAtlas: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.png',
      iconMapping: ICON_MAPPING,
      getIcon: getMapIcon,
      getPixelOffset: [64, 64],
      sizeScale: 15,
      getPosition: (d) => d,
      getSize: _ => 2,
      getColor: _ => [188, 188, 215],
      opacity: 0.5 ,
      data: intermediateOptimizationPoints
    });
  }


  var optimizedLocation = scorePoint.dataSync();

  return { location: optimizedLocation, layer: intermediateLocationLayer };

}

const calculateDistanceMatrixForSuperMarketsAndParkingLots = () => {
  let start = [map.getCenter().lng, map.getCenter().lat];
  const amountOfNeigbhors = 10;
  
  let aSuperMarkets = knn(superMarketRTree, start[0], start[1], amountOfNeigbhors);
  let aParkingLots = knn(parkingLotRTree, start[0], start[1], amountOfNeigbhors);

  const aDistanceParkingLotSuperMarket = [];

  for(let oSuperMarket of aSuperMarkets) {
    for(let oParkingLot of aParkingLots) {
      const input1 =  factory.createPoint(new jsts.geom.Coordinate (oSuperMarket.feature.geometry.coordinates[0], oSuperMarket.feature.geometry.coordinates[1]));
      const input2 =  factory.createPoint(new jsts.geom.Coordinate (oParkingLot.feature.geometry.coordinates[0], oParkingLot.feature.geometry.coordinates[1]));
      const distance = new jsts.operation.distance.DistanceOp( input1, input2).distance();
      aDistanceParkingLotSuperMarket.push({"distance": distance, "superMarket":oSuperMarket, "oParkingLot":oParkingLot})
    }
  }
  aSortedDinstanceParkingLotSuperMarket = aDistanceParkingLotSuperMarket.sort((a,b) => a.distance-b.distance);
  return aSortedDinstanceParkingLotSuperMarket;
};

// Currently not used anymore
const optimize = () => {
  let start = [map.getCenter().lng, map.getCenter().lat];
  let optimizedLocation = optimizeLocation(start, [superMarketRTree, parkingLotRTree]);
  let optimizedLocationLayer = new deck.IconLayer({
    id: 'optimized-location-layer',
    pickable: true,
    // iconAtlas and iconMapping are required
    // getIcon: return a string
    iconAtlas: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.png',
    iconMapping: ICON_MAPPING,
    getIcon: getMapIcon,
    sizeScale: 15,
    getPosition: getCoordinates,
    getSize: _ => 5,
    getColor: _ => [90,90,90],
    data: [{ "coordinates": optimizedLocation.location }]
  });

  let aLayers = [parkingLotLayer, superMarketLayer, optimizedLocationLayer];
  if (showIntermediatePoints) {
    aLayers.push(optimizedLocation.layer);
  }

  deckMap.setProps({
    layers: aLayers
  });
}

// Create Deck.GL map
let deckMap = new deck.DeckGL({
  mapStyle: 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json',
  initialViewState: {
    longitude: 13.302428631992042,
    latitude: 52.50131842240836,
    zoom: 15
  },
  layers: [parkingLotLayer, superMarketLayer],
  controller: true,
  onViewStateChange: ({ viewState }) => {
    deckMap.setProps({ viewState })
    map.jumpTo({
      center: [viewState.longitude, viewState.latitude],
      zoom: viewState.zoom,
      bearing: viewState.bearing,
      pitch: viewState.pitch
    });
  },
  onWebGLInitialized: () => {
    Promise.all([loadParkingLots(), loadSuperMarkets()]).then(() => {
      calculateDistanceMatrixForSuperMarketsAndParkingLots();
    })
  },
  onDragEnd: calculateDistanceMatrixForSuperMarketsAndParkingLots,

  /*shouldUpdateState: (props, oldProps, context, changeFlags) =>{
      alert("Redrawing is done");
  }*/
});


let currentPoint = 0;
backButton.addEventListener("click", _ => {
  currentPoint--;
  flyToPoint(currentPoint);
});

forwardButton.addEventListener("click", _ => {
  currentPoint++
  flyToPoint(currentPoint);
})

const flyToPoint = currentIndex => {
  let currentPoint2;
  let feature = aSortedDinstanceParkingLotSuperMarket;
  if (currentIndex > feature.length || currentIndex < 0) {
    currentIndex=currentPoint=0;
  }
  try {
    let featurePoint = aSortedDinstanceParkingLotSuperMarket[currentIndex].superMarket.feature;
    currentPoint2 = featurePoint.geometry.coordinates;
    getParkingSpaceInfo(feature[currentIndex].__source);
  } catch (error) {
    console.log(error);
  }
  if (currentPoint2) {
    console.log(`${currentPoint2[0]} : ${currentPoint2[1]}`);
    deckMap.setProps({
      viewState: {
        longitude: currentPoint2[0],
        latitude: currentPoint2[1],
        "zoom": 16,
        "minZoom": 5,
        "maxZoom": 20,
        "pitch": 40.5,
        "bearing": -27.396674584323023,
        transitionInterpolator: new deck.FlyToInterpolator(),
        transitionDuration: '1000'
      }
    });
    //TODO start optimize() again 
   // setTimeout(_=>{ deckMap.redraw(); }, 2000);
  }
  else {
    console.log("nothing to show");
  }
}
