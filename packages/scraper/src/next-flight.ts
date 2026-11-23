/**
 * A Next.js flight data chunk, one whole script: `self.__next_f.push([1,"<payload as a JSON string>"])`; the captured
 * part is the JSON string literal. Read by the Travel Expert parser and kept by trimFixture (task 62: the two had
 * written it apart, `\\[\s\S]` and `\\.` with the `s` flag, which match the same texts).
 */
export const FLIGHT_CHUNK = /^\s*self\.__next_f\.push\(\[1,("(?:[^"\\]|\\[\s\S])*")\]\)\s*;?\s*$/;
