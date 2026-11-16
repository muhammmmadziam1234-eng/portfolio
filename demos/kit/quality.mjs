const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
// [longitude, latitude] with an optional altitude, which is accepted and dropped.
const coordinate=x=>Array.isArray(x)&&(x.length===2||x.length===3)&&x.every(Number.isFinite)&&Math.abs(x[0])<=180&&Math.abs(x[1])<=90;
const newBounds=()=>[Infinity,Infinity,-Infinity,-Infinity];
function extend(b,[x,y]){b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y);}
function tidyText(value){return typeof value==='string'?value.trim().replace(/\s+/g,' '):'';}

const radians=d=>d*Math.PI/180;
function meters(a,b){
  const dLat=radians(b[1]-a[1]), dLon=radians(b[0]-a[0]);
  const h=Math.sin(dLat/2)**2+Math.cos(radians(a[1]))*Math.cos(radians(b[1]))*Math.sin(dLon/2)**2;
  return 2*6371008.8*Math.asin(Math.sqrt(Math.min(1,h)));
}
function nearbyPoints(points,radius){
  if(!radius)return [];
  const ordered=[...points].sort((a,b)=>a.coords[1]-b.coords[1]||a.id.localeCompare(b.id)), flags=[];
  const maxLatitudeGap=radius/6371008.8*180/Math.PI;
  for(let i=0;i<ordered.length;i++)for(let j=i+1;j<ordered.length;j++){
    const a=ordered[i],b=ordered[j];
    if(b.coords[1]-a.coords[1]>maxLatitudeGap+1e-12)break;
    const distance=meters(a.coords,b.coords);
    if(distance<=radius)flags.push({ids:[a.id,b.id].sort(),meters:Math.round(distance*10)/10});
  }
  return flags.sort((a,b)=>a.ids[0].localeCompare(b.ids[0])||a.ids[1].localeCompare(b.ids[1]));
}
export function cleanPoints(input,{precision=6,nearMeters=15}={}){
  if(!isObject(input)||input.type!=='FeatureCollection'||!Array.isArray(input.features))
    throw new TypeError('Input must be a GeoJSON FeatureCollection.');
  if(!Number.isInteger(precision)||precision<0||precision>8)throw new RangeError('Precision must be an integer from 0 to 8.');
  if(!Number.isFinite(nearMeters)||nearMeters<0||nearMeters>1000)throw new RangeError('Proximity radius must be from 0 to 1000 metres.');
  const features=[], rejected=[], points=[], ids=new Map(), byCategory=new Map(), bounds=newBounds();
  const reject=(index,rawId,reason,extra={})=>rejected.push({index,id:typeof rawId==='string'?rawId:null,reason,...extra});
  for(const [index,raw] of input.features.entries()){
    if(!isObject(raw)||raw.type!=='Feature'||!isObject(raw.properties)){reject(index,null,'invalid_feature');continue;}
    // The feature's own id wins; properties.id is used when that is missing or not text.
    const {properties:p,geometry:g}=raw, rawId=[raw.id,p.id].find(v=>typeof v==='string'&&v.trim()!=='')??null;
    const id=tidyText(rawId).toUpperCase(), name=tidyText(p.name), category=tidyText(p.category).toLowerCase();
    if(!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(id)||!name||!category){reject(index,rawId,'missing_or_invalid_fields');continue;}
    if(g?.type!=='Point'||!coordinate(g.coordinates)){reject(index,rawId,'invalid_point');continue;}
    if(ids.has(id)){reject(index,rawId,'duplicate_id',{keptIndex:ids.get(id)});continue;}
    const [lon,lat]=g.coordinates, coords=[lon,lat].map(n=>Number(n.toFixed(precision))||0);
    ids.set(id,index);points.push({id,coords:[lon,lat]});extend(bounds,coords);byCategory.set(category,(byCategory.get(category)??0)+1);
    features.push({type:'Feature',id,geometry:{type:'Point',coordinates:coords},properties:{name,category}});
  }
  const bbox=features.length?bounds:null;
  const cleaned={type:'FeatureCollection',...(bbox?{bbox}:{}),features};
  const report={input:input.features.length,accepted:features.length,rejected:rejected.length,precision,bbox,nearMeters,nearby:nearbyPoints(points,nearMeters),
    categories:Object.fromEntries([...byCategory].sort(([a],[b])=>a.localeCompare(b))),issues:rejected};
  return {cleaned,report};
}
