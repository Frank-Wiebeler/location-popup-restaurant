const showIntermediatePoints = true;

const parkingLotRTree = new rbush();
const superMarketRTree = new rbush();
const peopleRTree = new rbush();
const sectionText = document.getElementById("SECTIONID");
const parkingText = document.getElementById("INFOPARKING");
const resultOverviewText = document.getElementById("resultview-area");
const backButton = document.getElementById("back-id");
const forwardButton = document.getElementById("forward-id");
const startButton = document.getElementById("start-btn-id");
const locateMeButton = document.getElementById("locate-me");
const loader = document.getElementById("loader");
const sectionHtml = document.getElementById("data-section-id");
const sectionStartButtonHtml = document.getElementById("start-button-area");
const factory = new jsts.geom.GeometryFactory();
const revenue = document.getElementById("revenue-potential");
const dailySales = document.getElementById("daily-sales");
const supermarketName = document.getElementById("supermarket-name");
const navigationFooterHtml = document.getElementById("navigation-footer");


var aSortedDistanceParkingLotSuperMarket;

const COLOR_SCALE = [
  // negative
  [65, 182, 196],
  [127, 205, 187],
  [199, 233, 180],
  [237, 248, 177],

  // positive
  [255, 255, 204],
  [255, 237, 160],
  [254, 217, 118],
  [254, 178, 76],
  [253, 141, 60],
  [252, 78, 42],
  [227, 26, 28],
  [189, 0, 38],
  [128, 0, 38]
];

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



const getParkingSpaceInfo = (evt, oFeature) => {
  let areaParkingSpot = 0;
  if (evt) {
    // if this is a polygon calculate the area
    if(evt && evt.object && evt.object.geometry && evt.object.geometry.coordinates
      && evt.object.geometry.coordinates.length > 0 && "map" in evt.object.geometry.coordinates[0]) {    
      let coord = evt.object.geometry.coordinates[0].map(e => new jsts.geom.Coordinate(e[0], e[1]));
      areaParkingSpot = factory.createPolygon(coord).getArea();
    }
    revenue.innerHTML = (Math.random() * 1000).toFixed() + " €";
    dailySales.innerHTML = (Math.random() * 200).toFixed();
    supermarketName.innerHTML = oFeature.properties ? oFeature.properties.name : "";
  }
  else {
    revenue.innerHTML = "";
    dailySales.innerHTML = "";
    supermarketName.innerHTML = "Parkplatz";
    let coord = oFeature.object.geometry.coordinates[0].map(e => new jsts.geom.Coordinate(e[0], e[1]));
    areaParkingSpot = factory.createPolygon(coord).getArea();
  }

  let areaqm = areaParkingSpot * 1000000000;
  document.getElementById("parkinglot-area").innerHTML = `${areaqm.toFixed()} m²`;
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
  onClick: evt => getParkingSpaceInfo(null, evt)
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

const peopleLayer = new deck.GeoJsonLayer({
  id: 'people-layer',
  pickable: true,
  stroked: false,
  filled: true,
  extruded: true,
  lineWidthScale: 20,
  lineWidthMinPixels: 2,
  opacity: 0.07,
  getElevation: d => Math.sqrt(d.properties.einwohner / d.properties.qkm) * 0.1,
  getFillColor: d => colorScale((d.properties.einwohner / d.properties.qkm) / 5000),
  getLineColor: [255, 255, 255],
  getRadius: 5,
  getLineWidth: 1,

});

function colorScale(x) {
  const i = Math.round(x * 1) + 4;
  if (x < 0) {
    return COLOR_SCALE[i] || COLOR_SCALE[0];
  }
  return COLOR_SCALE[i] || COLOR_SCALE[COLOR_SCALE.length - 1];
}



function getTooltip({ object }) {
  return object && `
    Bezirk ${(object.properties.note)}
    Einwohner/km²: ${Math.round(object.properties.einwohner / object.properties.qkm)}`;
}

const ICON_MAPPING = {
  marker: {x: 0, y: 0, width: 128, height: 128, mask: true, anchorX: 64, anchorY: 140}
};

const getCoordinates = d => {
  return d.coordinates;
}

function onLoadInit(){
}

let bottomLeft = [13.3, 52.5];
let topRight = [13.35, 52.55];

let displayLoaderCounter = 0;


function showLoader() {
  displayLoaderCounter++;
  if (displayLoaderCounter > 0) {
    loader.style.display = "initial";
  }
}

function hideLoader() {
  displayLoaderCounter--;
  if (displayLoaderCounter <= 0) {
    loader.style.display = "none";
    resetTour();
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

function loadPeople() {
  let query = bottomLeft[0] + `%2C` + bottomLeft[1]  + `%2C` + topRight[0] + `%2C` + topRight[1];
  let queryURL = "https://services2.arcgis.com/jUpNdisbWqRpMo35/arcgis/rest/services/PLZ_Gebiete/FeatureServer/0/query?where=1%3D1&outFields=*&geometry="+query+"&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outSR=4326&f=geojson";
  loadLayerWithGis(peopleLayer,queryURL, peopleRTree);
}


function loadLayerWithGis(oLayer, oQuery, oRIndex) {
  showLoader();
  
  fetch(oQuery, {
    //"body": oQuery,
    "method": "POST"
  }).then(res => res.json()).then(oResult => {

    // let oFeatureCollection = ArcgisToGeojsonUtils.arcgisToGeoJSON(oResult);
    let oFeatureCollection = oResult;


    for (let oFeature of oFeatureCollection.features) {
      if (oFeature.geometry.type == "Point") {

        oRIndex.insert({
          "minX": oFeature.geometry.coordinates[0],
          "minY": oFeature.geometry.coordinates[1],
          "maxX": oFeature.geometry.coordinates[0],
          "maxY": oFeature.geometry.coordinates[1],
          "point": oFeature.geometry.coordinates,
          "feature": oFeature
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
          "point": oFeature.geometry.coordinates,
          "feature": oFeature
        });
      } else if (oFeature.geometry.type == "Polygon") {
        let coord = oFeature.geometry.coordinates[0].map(e => new jsts.geom.Coordinate(e[0], e[1]));
        let oPolygon = factory.createPolygon(coord);
        let oCenter = oPolygon.getCentroid().getCoordinate();
        oRIndex.insert({
          "minX": oCenter.x,
          "minY": oCenter.y,
          "maxX": oCenter.x,
          "maxY": oCenter.y,
          "point": [oCenter.x, oCenter.y],
          "feature": oFeature
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

    resultOverviewText.innerHTML=`Gefundene Superm&auml;rkte: ${oFeatureCollection.features.length}`;

    hideLoader();
  }).catch(e => {
    console.error(e);
  });
}


let aUniqueSortedDistanceParkingLotSuperMarket = [];
const calculateDistanceMatrixForSuperMarketsAndParkingLots = () => {
  let start = [map.getCenter().lng, map.getCenter().lat];
  const amountOfNeigbhors = 25;

  let aSuperMarkets = knn(superMarketRTree, start[0], start[1], amountOfNeigbhors);
  let aParkingLots = knn(parkingLotRTree, start[0], start[1], amountOfNeigbhors);

  const aDistanceParkingLotSuperMarket = [];

  for (let oSuperMarket of aSuperMarkets) {
    for (let oParkingLot of aParkingLots) {
      const input1 = factory.createPoint(new jsts.geom.Coordinate(oSuperMarket.point[0], oSuperMarket.point[1]));
      const input2 = factory.createPoint(new jsts.geom.Coordinate(oParkingLot.point[0], oParkingLot.point[1]));
      const distance = new jsts.operation.distance.DistanceOp(input1, input2).distance();
      aDistanceParkingLotSuperMarket.push({ "distance": distance, "superMarket": oSuperMarket, "parkingLot": oParkingLot })
    }
  }
  aSortedDistanceParkingLotSuperMarket = aDistanceParkingLotSuperMarket.sort((a, b) => a.distance - b.distance);

  let mMapAlreadyIn = {};
  for (let oItems of aSortedDistanceParkingLotSuperMarket) {
    let sSuperMarketId = oItems.superMarket.feature.id;
    if (!(sSuperMarketId in mMapAlreadyIn)) {
      mMapAlreadyIn[sSuperMarketId] = true;
      aUniqueSortedDistanceParkingLotSuperMarket.push(oItems);
    }


  }


  return aUniqueSortedDistanceParkingLotSuperMarket;
};

// Create Deck.GL map	
let deckMap = new deck.DeckGL({
  mapStyle: 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json',
  initialViewState: {
    longitude: 13.302428631992042,
    latitude: 52.50131842240836,
    zoom: 15
  },
  layers: [superMarketLayer, parkingLotLayer, peopleLayer],
  getTooltip,
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
    setTourLoading();
    Promise.all([loadParkingLots(), loadSuperMarkets()]).then(() => {
      calculateDistanceMatrixForSuperMarketsAndParkingLots();
    })
    loadPeople();
  },
  onDragEnd: calculateDistanceMatrixForSuperMarketsAndParkingLots
});

function startTour(){
  console.log("Start tour");
  sectionStartButtonHtml.style.display = "none";
  sectionHtml.style.display = "block";
  navigationFooterHtml.style.display = "block";  

}


function resetTour(){
  console.log("Reset tour");
  sectionStartButtonHtml.style.display = "block";  
  sectionHtml.style.display = "none";
  navigationFooterHtml.style.display = "none"
}

function setTourLoading(){
  console.log("set Tour Loading");
  sectionStartButtonHtml.style.display = "none";
  sectionHtml.style.display = "none";
  navigationFooterHtml.style.display = "none";

}

let currentPoint = 0;
backButton.addEventListener("click", _ => {
  currentPoint--;
  flyToPoint(currentPoint);
});

forwardButton.addEventListener("click", _ => {
  currentPoint++
  flyToPoint(currentPoint);
});

startButton.addEventListener("click", _ => {
  currentPoint = 1;
  startTour();
  flyToPoint(currentPoint);
})

const flyToPoint = currentIndex => {
  let currentPoint2;
  if (!aUniqueSortedDistanceParkingLotSuperMarket) {
    return;
  }
  let feature = aUniqueSortedDistanceParkingLotSuperMarket;
  if (currentIndex > feature.length || currentIndex < 0) {
    backButton.disabled = true
    currentIndex = currentPoint = 0;
  } else {
    backButton.disabled = false
  }
  try {
    currentPoint2 = aUniqueSortedDistanceParkingLotSuperMarket[currentIndex].superMarket.point;
    getParkingSpaceInfo({ "object": aUniqueSortedDistanceParkingLotSuperMarket[currentIndex].parkingLot.feature }, aSortedDistanceParkingLotSuperMarket[currentIndex].superMarket.feature);
  } catch (error) {
    console.log(error);
  }
  if (currentPoint2) {

    let iconLayer = new deck.IconLayer({
      id: 'icon-layer',
      data:[currentPoint2],
      pickable: true,
      // iconAtlas and iconMapping are required
      // getIcon: return a string
      iconAtlas: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.png',
      iconMapping: ICON_MAPPING,
      getIcon: d => 'marker',
      sizeScale: 15,
      getPosition: d => d,
      getSize: d => 5,
      getColor: d => [Math.sqrt(d.exits), 140, 0]
    });    

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
      },
      layers: [iconLayer,superMarketLayer,parkingLotLayer,peopleLayer]      
    });
  }
  else {
    console.log("nothing to show");
  }
}

locateMeButton.addEventListener("click", () => {
  navigator.geolocation.getCurrentPosition((position) => {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;

    bottomLeft = [longitude - 0.05, latitude - 0.05];
    topRight = [longitude + 0.05, latitude + 0.05];

    deckMap.setProps({
      viewState: {
        longitude: longitude,
        latitude: latitude,
        "zoom": 16,
        "minZoom": 5,
        "maxZoom": 20,
        "pitch": 40.5,
        "bearing": -27.396674584323023,
        transitionInterpolator: new deck.FlyToInterpolator(),
        transitionDuration: '1000'
      }
    });

    Promise.all([loadParkingLots(), loadSuperMarkets()]).then(() => {
      calculateDistanceMatrixForSuperMarketsAndParkingLots();
    });
    loadPeople();

  }, (error) => {
    console.log.error(error);
  });
});