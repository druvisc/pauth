/** String operations */
// export const StrEnum = <T extends string>(keys: Array<T>): {[K in T]: K} =>
//   keys.reduce((StrEnum, k) => {
//     StrEnum[k] = k;
//     return StrEnum;
//   }, Object.create(null));


export function StrEnum<T extends string>(o: Array<T>): {[K in T]: K} {
  return o.reduce((res, key) => {
    res[key] = key;
    return res;
  }, Object.create(null));
}


export const ignoreCaseEqual = (str1: string, str2: string): boolean =>
  str1.toUpperCase() === str2.toUpperCase();
/** String operations */


/** Type checking */
export const isNull = (v): boolean => v === null;
export const isArray = (v): boolean => Array.isArray(v);
export const isUndefined = (v): boolean => v === undefined;
export const isBoolean = (v): boolean => typeof v === 'boolean';
export const isPresent = (v): boolean => !isNull(v) && !isUndefined(v);
export const isNumber = (v): boolean => !isNaN(Number(v)) && isFinite(v);
export const isObject = (v): boolean => typeof v === 'object' && !isArray(v) && !isNull(v);
/** Type checking */