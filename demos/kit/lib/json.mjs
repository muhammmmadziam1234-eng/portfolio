// JSON.parse with an error that says where the text broke. The position comes from a small
// scanner for the JSON grammar (RFC 8259) that runs only after JSON.parse has failed, so
// the line and column are the same in every engine and do not depend on its error message.
const isDigit = c => c >= '0' && c <= '9';
const isHex = code => (code >= 48 && code <= 57) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102);

/** Offset of the first character that breaks the JSON grammar (text.length when the text ends too early), or null. */
export function firstErrorOffset(s) {
  const n = s.length;
  let i = 0;
  const bad = () => { throw i; };
  const skip = () => { while (i < n && (s[i] === ' ' || s[i] === '\t' || s[i] === '\n' || s[i] === '\r')) i++; };
  function string() {
    i++;
    for (;;) {
      if (i >= n) bad();
      const c = s.charCodeAt(i);
      if (c === 34) { i++; return; }
      if (c < 32) bad();
      if (c !== 92) { i++; continue; }
      i++;
      if (s[i] === 'u') {
        for (let k = 1; k <= 4; k++) if (!isHex(s.charCodeAt(i + k))) { i += k; bad(); }
        i += 5;
      } else if (s[i] !== undefined && '"\\/bfnrt'.includes(s[i])) i++;
      else bad();
    }
  }
  function digits() { if (!isDigit(s[i])) bad(); while (isDigit(s[i])) i++; }
  function number() {
    if (s[i] === '-') i++;
    if (s[i] === '0') i++; else digits();
    if (s[i] === '.') { i++; digits(); }
    if (s[i] === 'e' || s[i] === 'E') { i++; if (s[i] === '+' || s[i] === '-') i++; digits(); }
  }
  function value(depth) {
    skip();
    if (i >= n || depth > 512) bad();
    const c = s[i];
    if (c === '{') {
      i++; skip();
      if (s[i] === '}') { i++; return; }
      for (;;) {
        skip(); if (s[i] !== '"') bad();
        string(); skip(); if (s[i] !== ':') bad();
        i++; value(depth + 1); skip();
        if (s[i] === ',') { i++; continue; }
        if (s[i] === '}') { i++; return; }
        bad();
      }
    }
    if (c === '[') {
      i++; skip();
      if (s[i] === ']') { i++; return; }
      for (;;) {
        value(depth + 1); skip();
        if (s[i] === ',') { i++; continue; }
        if (s[i] === ']') { i++; return; }
        bad();
      }
    }
    if (c === '"') return string();
    if (c === '-' || isDigit(c)) return number();
    for (const word of ['true', 'false', 'null']) if (s.startsWith(word, i)) { i += word.length; return; }
    bad();
  }
  try { value(0); skip(); if (i < n) bad(); return null; } catch (e) { if (typeof e === 'number') return Math.min(e, n); throw e; }
}

/** 1-based line and column of an offset in text. */
export function lineAndColumn(text, offset) {
  let line = 1, lastBreak = -1;
  for (let k = 0; k < offset; k++) if (text.charCodeAt(k) === 10) { line++; lastBreak = k; }
  return {line, column: offset - lastBreak};
}

/** {value} when text is valid JSON, else {error: {code: 'invalid_json', message, detail, line, column, offset}}; message names the position, detail does not. */
export function parseJson(text) {
  try { return {value: JSON.parse(text)}; } catch (e) {
    const offset = firstErrorOffset(text);
    if (offset === null) return {error: {code: 'invalid_json', message: e.message, detail: e.message, line: 1, column: 1, offset: 0}};
    const {line, column} = lineAndColumn(text, offset);
    const detail = 'Unexpected ' + (offset >= text.length ? 'end of the text' : 'character ' + JSON.stringify(text[offset]));
    return {error: {code: 'invalid_json', message: detail + ' at line ' + line + ', column ' + column, detail, line, column, offset}};
  }
}
