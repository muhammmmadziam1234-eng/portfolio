// Every finding the kit can report has one stable code. README.md documents the same table
// and a test keeps the two in step. Severity "error" rejects the feature; "warning" never does.
const e = (appliesTo, summary, details, fix) => Object.freeze({severity: 'error', appliesTo, summary, details, fix});
const w = (appliesTo, summary, details, fix) => Object.freeze({severity: 'warning', appliesTo, summary, details, fix});

// `details` names the keys of the details object ("polygon?" is present only inside a MultiPolygon).
export const ISSUE_CODES = Object.freeze({
  invalid_json: e('record', 'An NDJSON line is not valid JSON.', 'line, column, message', 'Fix the syntax on that line; the details give its line number in the file.'),
  invalid_feature: e('feature', 'The record is not a Feature object with a properties object.', '-', 'Write it as {"type":"Feature","geometry":{...},"properties":{...}}.'),
  invalid_id: e('feature', 'No usable id in id or properties.id.', 'reason (only for a MultiPoint id that is too long to number)', 'Use 1 to 40 letters, digits, "_" or "-", not starting with "_" or "-".'),
  missing_property: e('feature', 'A required property is missing or blank.', 'property', 'Add a text value for the property named in the details.'),
  invalid_property_value: e('feature', 'A property is not one of the allowed values.', 'property, value, allowed', 'Use one of the values listed in the details.'),
  duplicate_id: e('feature', 'The id was already used by an earlier accepted feature.', 'keptIndex, id', 'Give each feature its own id; the first one is kept.'),
  null_geometry: e('geometry', 'The geometry is null or missing.', '-', 'Add a geometry, or drop the record.'),
  geometry_collection_unsupported: e('geometry', 'GeometryCollection is not supported.', '-', 'Split it into one feature per member geometry.'),
  unknown_geometry_type: e('geometry', 'The geometry type is not a GeoJSON geometry type.', 'type', 'Use Point, MultiPoint, LineString, MultiLineString, Polygon or MultiPolygon.'),
  geometry_type_not_allowed: e('geometry', 'The geometry type is excluded by the geometryTypes option.', 'type, allowed', 'Allow the type, or send this feature to a different output.'),
  invalid_coordinates: e('geometry', 'Coordinates are missing, nested wrongly, or a position is not 2 or 3 finite numbers.', 'path, problem', 'Write positions as [longitude, latitude] or [longitude, latitude, altitude].'),
  coordinate_out_of_range: e('geometry', 'Longitude is outside -180 to 180 or latitude outside -90 to 90.', 'path, axis, value', 'Check the axis order (longitude first) and the coordinate system (WGS 84 degrees).'),
  empty_geometry: e('geometry', 'A coordinates array that must hold positions is empty.', 'path', 'Add the positions, or drop the feature.'),
  line_too_short: e('geometry', 'A line has fewer than 2 distinct positions after rounding.', 'path, distinct', 'Add a second, different position, or use a Point.'),
  ring_too_short: e('geometry', 'A polygon ring has fewer than 4 positions after cleaning.', 'path, positions', 'A ring needs at least 3 different corners, closed by repeating the first.'),
  ring_zero_area: e('geometry', 'All positions of a polygon ring lie on one line (or collapse to one point when rounded).', 'path', 'Fix the corners, or raise the precision if the polygon really is that small.'),
  self_intersection: e('geometry', 'Two segments of one ring cross, touch or overlap.', 'polygon?, ring, segments', 'Redraw the ring; the details give the two segment indices in the input ring.'),
  rings_intersect: e('geometry', 'Two rings of one polygon share a point.', 'polygon?, rings, segments', 'Move the hole away from the exterior ring and from other holes.'),
  invalid_hole: e('geometry', 'A hole lies outside the exterior ring, or inside another hole.', 'polygon?, ring, reason', 'Move the hole inside the exterior ring, or make it a separate polygon.'),
  multipoint_exploded: w('geometry', 'A MultiPoint was split into one Point feature per position.', 'count, ids', 'None needed. Output ids are the input id plus -1, -2, and so on.'),
  duplicate_positions: w('geometry', 'Consecutive duplicate positions were removed.', 'count, at', 'None needed; remove them at the source to silence the warning.'),
  ring_not_closed: w('geometry', 'A ring did not end where it started; the first position was appended.', 'count, at', 'Repeat the first position at the end of each ring.'),
  ring_orientation: w('geometry', 'An exterior ring ran clockwise or a hole counter-clockwise; it was reversed.', 'count, at', 'RFC 7946 wants exterior rings counter-clockwise and holes clockwise.'),
  antimeridian_crossing: w('geometry', 'A segment spans more than 180 degrees of longitude, so it probably crosses the antimeridian.', 'count, at', 'Kept as written. Split the geometry at 180 degrees if the consumer needs it (RFC 7946 section 3.1.9).')
});

const at = path => (path && path.length ? ' (coordinates' + path.map(i => '[' + i + ']').join('') + ')' : '');
const where = d => (d.polygon === undefined ? '' : ' in polygon ' + d.polygon);
const messages = {
  invalid_json: d => 'Line ' + d.line + ' is not valid JSON: ' + d.message + '. Fix the syntax on that line.',
  invalid_feature: () => 'Not a GeoJSON Feature with a properties object. Write it as {"type":"Feature","geometry":{...},"properties":{...}}.',
  invalid_id: d => (d.reason ? d.reason : 'No usable id. Give the feature an id (or properties.id) of 1 to 40 letters, digits, "_" or "-".'),
  missing_property: d => 'Property "' + d.property + '" is missing or blank. Add a text value for it.',
  invalid_property_value: d => 'Property "' + d.property + '" is "' + d.value + '", which is not one of: ' + d.allowed.join(', ') + '.',
  duplicate_id: d => 'The id is already used by the accepted feature at index ' + d.keptIndex + '. Give this feature its own id.',
  null_geometry: () => 'The geometry is null or missing. Add a geometry or drop the record.',
  geometry_collection_unsupported: () => 'GeometryCollection is not supported. Split it into one feature per member geometry.',
  unknown_geometry_type: d => 'Geometry type ' + JSON.stringify(d.type) + ' is not a GeoJSON geometry type. Use Point, MultiPoint, LineString, MultiLineString, Polygon or MultiPolygon.',
  geometry_type_not_allowed: d => d.type + ' is not in the allowed geometry types (' + d.allowed.join(', ') + '). Allow it with the geometryTypes option or --types.',
  invalid_coordinates: d => 'Invalid coordinates' + at(d.path) + ': ' + d.problem + '. Write positions as [longitude, latitude].',
  coordinate_out_of_range: d => 'The ' + d.axis + ' ' + d.value + ' is out of range' + at(d.path) + '. Longitude must be within 180 and latitude within 90; check the axis order.',
  empty_geometry: d => 'An empty coordinates array' + at(d.path) + '. Add the positions or drop the feature.',
  line_too_short: d => 'A line' + at(d.path) + ' has only ' + d.distinct + ' distinct position after rounding; it needs 2. Add another position or use a Point.',
  ring_too_short: d => 'A ring' + at(d.path) + ' has only ' + d.positions + ' positions after cleaning; it needs 4 (three corners plus the closing position).',
  ring_zero_area: d => 'A ring' + at(d.path) + ' encloses no area. Check that its corners are not on one line or collapsed by rounding.',
  self_intersection: d => 'Ring ' + d.ring + where(d) + ' crosses itself between segments ' + d.segments[0] + ' and ' + d.segments[1] + '. Redraw the ring.',
  rings_intersect: d => 'Ring ' + d.rings[0] + ' (segment ' + d.segments[0] + ') and ring ' + d.rings[1] + ' (segment ' + d.segments[1] + ')' + where(d) + ' share a point. Move the hole.',
  invalid_hole: d => 'Hole ' + d.ring + where(d) + (d.reason === 'inside_other_hole' ? ' lies inside another hole.' : ' lies outside the exterior ring.') + ' Move it, or make it a separate polygon.',
  multipoint_exploded: d => 'MultiPoint split into ' + d.count + ' Point features: ' + d.ids.join(', ') + '.',
  duplicate_positions: d => d.count + ' consecutive duplicate position(s) removed.',
  ring_not_closed: d => d.count + ' ring(s) were not closed; the first position was appended.',
  ring_orientation: d => d.count + ' ring(s) reversed to follow the right-hand rule.',
  antimeridian_crossing: d => d.count + ' segment(s) span more than 180 degrees of longitude; kept as written.'
};

export function messageFor(code, details = {}) { return messages[code](details); }
export function makeFinding(code, details = {}) {
  return {code, severity: ISSUE_CODES[code].severity, message: messageFor(code, details), details};
}
