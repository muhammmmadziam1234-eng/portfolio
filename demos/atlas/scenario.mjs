// A fictional coast. Coordinates are WGS84, with artwork authored on a local grid.
export const width=1000,height=680;
const anchor=[79.7,7.02], degrees=0.000035;
/** @param {number[]} p A position on the local artwork grid. @returns {[number, number]} Longitude and latitude. */
const position=([x,y])=>[+(anchor[0]+x*degrees/Math.cos(anchor[1]*Math.PI/180)).toFixed(8),+(anchor[1]-y*degrees).toFixed(8)];
/** @type {import('./view.mjs').Projection} */
export const project=([lon,lat])=>[(lon-anchor[0])*Math.cos(anchor[1]*Math.PI/180)/degrees,(anchor[1]-lat)/degrees];
/** @param {number[][]} points */
const ring=points=>[...points,points[0]].map(position);
/** @param {string} type @param {any} coordinates @param {any} properties @returns {any} */
const feature=(type,coordinates,properties)=>({type:'Feature',geometry:{type,coordinates},properties});
/** @param {number[][]} points @param {any} properties */
const polygon=(points,properties)=>feature('Polygon',[ring(points)],properties);
/** @template T @param {T[]} features @returns {import('./geo.mjs').Collection<T>} */
const collection=features=>({type:'FeatureCollection',features});
/** @param {string} s @returns {number[][]} */
const parse=s=>s.split(' ').map(pair=>pair.split(',').map(Number));
/** @param {string} s @param {any} p */
const shape=(s,p)=>polygon(parse(s),p);
/** @type {import('./geo.mjs').Collection<import('./geo.mjs').Zone>} */
export const zones=collection([
  shape('276,610 304,538 375,515 428,457 447,373 521,297 552,228 626,193 733,178 794,137 900,147 971,183 978,313 896,354 833,420 759,424 676,469 620,558 529,619 407,660 320,650',{name:'Estuary floodplain',level:'low'}),
  shape('347,581 391,534 461,485 483,399 551,324 589,241 680,220 760,217 827,180 896,192 934,233 925,284 837,309 781,360 713,373 635,423 588,509 492,575 403,610',{name:'River overflow corridor',level:'moderate'}),
  shape('406,563 449,518 496,454 513,400 581,328 610,279 674,250 748,251 801,223 868,218 896,242 865,268 790,283 734,322 675,337 605,389 558,481 497,534 443,574',{name:'Lower Alder floodway',level:'high'}),
  shape('231,225 247,160 289,122 342,116 369,155 354,207 311,243 267,254',{name:'North inlet',level:'moderate'})
]);
/** @type {import('./geo.mjs').Collection<import('./geo.mjs').Zone>} */
export const expandedZones=collection(zones.features.map(f=>{
  const coords=/** @type {import('./geo.mjs').PolygonGeometry} */ (f.geometry).coordinates[0].slice(0,-1).map(project);
  const center=coords.reduce(([a,b],[x,y])=>[a+x/coords.length,b+y/coords.length],[0,0]);
  const reach={low:1.15,moderate:1.28,high:1.44}[f.properties.level];
  return polygon(coords.map(([x,y])=>[center[0]+(x-center[0])*reach,center[1]+(y-center[1])*reach]),f.properties);
}));
/** @type {import('./geo.mjs').Collection<import('./geo.mjs').Site>} */
export const sites=collection(/** @type {[string,string,string,number,number][]} */ ([
  ['S01','Harbour Clinic','Health',454,533],['S02','West Pier Depot','Utilities',323,592],
  ['S03','Estuary Pump Station','Utilities',577,442],['S04','Alder Primary School','Education',608,354],
  ['S05','Eastbank Fire Station','Emergency',795,332],['S06','North Inlet Clinic','Health',295,179],
  ['S07','Westgate School','Education',342,348],['S08','Briar Community Centre','Community',821,505],
  ['S09','Marshgate School','Education',590,535],['S10','Hillcrest Reservoir','Utilities',690,106],
  ['S11','Orchard Library','Community',909,433],['S12','Quarry Medical Centre','Health',904,256],
  ['S13','Harbour Rescue Post','Emergency',322,454],['S14','Alder Water Plant','Utilities',760,268],
  ['S15','Cedar Primary School','Education',655,434],['S16','Northridge Library','Community',512,132]
]).map(([id,name,category,x,y])=>feature('Point',position([x,y]),{id,name,category})));
export const land=parse('201,0 1000,0 1000,680 255,680 274,633 255,597 263,553 210,522 228,475 211,429 244,374 226,326 250,284 218,248 213,201 235,155 191,126 205,88 186,60');
export const river='M 347 680 C 377 617 423 591 457 555 S 507 511 532 463 S 551 407 587 370 S 612 314 653 292 S 727 283 760 270 S 827 238 858 245 S 927 258 1000 190';
export const roads=[
  'M 230 330 C 370 350 432 315 541 325 S 745 368 1000 334','M 220 480 C 388 453 507 474 624 453 S 856 437 1000 464',
  'M 344 0 Q 400 205 382 377 T 420 680','M 514 0 Q 495 177 541 325 T 606 680',
  'M 698 0 Q 678 184 725 385 T 711 680','M 896 0 Q 812 171 860 345 T 872 680',
  'M 235 175 Q 480 221 651 167 T 1000 125','M 256 580 Q 523 550 750 570 T 1000 561'];
